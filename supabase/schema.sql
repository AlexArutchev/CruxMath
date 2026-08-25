-- CruxMath schema.
-- Run once in the Supabase SQL editor (or via `supabase db push`).
-- Safe to re-run: every statement is guarded.

-- ---------------------------------------------------------------------------
-- CONTENT (public read, service-role write)
-- ---------------------------------------------------------------------------

create table if not exists public.problems (
  id          text primary key,              -- e.g. '2022-amc-10a-21'
  contest     text        not null,          -- e.g. '2022 AMC 10A'
  num         int         not null,
  statement   text        not null,          -- LaTeX source, rendered by KaTeX
  answer      text,                          -- 'B', '337', or prose for odd cases
  difficulty  numeric(4,2),
  tier        text,
  topics      text[]      not null default '{}',
  figure_img  text,                          -- official contest figure URL, if any
  has_ladder  boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (contest, num)
);

create table if not exists public.ladders (
  problem_id  text primary key references public.problems(id) on delete cascade,
  title       text,
  approach    text,
  rungs       jsonb       not null default '[]'::jsonb,  -- [{title, bodyHtml}]
  review_html text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Full-text search over statements, kept in sync by Postgres itself.
alter table public.problems
  add column if not exists statement_fts tsvector
  generated always as (to_tsvector('english', coalesce(statement, ''))) stored;

create index if not exists problems_statement_fts_idx on public.problems using gin (statement_fts);
create index if not exists problems_contest_idx       on public.problems (contest);
create index if not exists problems_difficulty_idx    on public.problems (difficulty);
create index if not exists problems_has_ladder_idx    on public.problems (has_ladder);
create index if not exists problems_topics_idx        on public.problems using gin (topics);

-- ---------------------------------------------------------------------------
-- PROGRESS (per anonymous device-user or optional Clerk account, protected by RLS)
-- ---------------------------------------------------------------------------

create table if not exists public.user_progress (
  -- Supabase anonymous identities are UUIDs; Clerk identities look like
  -- `user_...`. Text permits both, so anonymous practice remains opt-in-free.
  user_id        text        not null,
  problem_id     text        not null references public.problems(id) on delete cascade,
  solved         boolean     not null default false,
  hints_revealed int         not null default 0,
  attempts       int         not null default 0,
  aops_viewed    boolean     not null default false,
  first_seen_at  timestamptz not null default now(),
  solved_at      timestamptz,
  updated_at     timestamptz not null default now(),
  primary key (user_id, problem_id)
);

create index if not exists user_progress_user_idx on public.user_progress (user_id);

-- Existing installations began with `user_id uuid references auth.users`. Keep
-- the anonymous rows, but make room for Clerk's string user ids. The guard lets
-- a fresh install and an already-migrated database both run this file safely.
-- Postgres will not alter a column while an RLS policy references it, so release
-- the four old policies first. They are immediately recreated below with the
-- same ownership guarantee, but one that also accepts Clerk's string subject.
drop policy if exists "own progress select" on public.user_progress;
drop policy if exists "own progress insert" on public.user_progress;
drop policy if exists "own progress update" on public.user_progress;
drop policy if exists "own progress delete" on public.user_progress;

do $$
declare
  user_id_type text;
begin
  select data_type into user_id_type
  from information_schema.columns
  where table_schema = 'public' and table_name = 'user_progress' and column_name = 'user_id';

  if user_id_type = 'uuid' then
    alter table public.user_progress drop constraint if exists user_progress_user_id_fkey;
    alter table public.user_progress alter column user_id type text using user_id::text;
  end if;
end;
$$;

-- Keep updated_at honest without trusting the client.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_progress_touch on public.user_progress;
create trigger user_progress_touch
  before update on public.user_progress
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

alter table public.problems      enable row level security;
alter table public.ladders       enable row level security;
alter table public.user_progress enable row level security;

-- Content is readable by everyone, including anonymous sessions.
-- No insert/update/delete policy exists, so only the service role can write it.
drop policy if exists "problems are public" on public.problems;
create policy "problems are public"
  on public.problems for select
  to anon, authenticated
  using (true);

drop policy if exists "ladders are public" on public.ladders;
create policy "ladders are public"
  on public.ladders for select
  to anon, authenticated
  using (true);

-- Progress is private to the identity in the JWT `sub` claim. This works for
-- both Supabase anonymous sessions (UUID subjects) and Clerk sessions
-- (`user_...` subjects). Do not use auth.uid() here: Clerk ids are not UUIDs.
drop policy if exists "own progress select" on public.user_progress;
create policy "own progress select"
  on public.user_progress for select
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "own progress insert" on public.user_progress;
create policy "own progress insert"
  on public.user_progress for insert
  to authenticated
  with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "own progress update" on public.user_progress;
create policy "own progress update"
  on public.user_progress for update
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id)
  with check ((select auth.jwt() ->> 'sub') = user_id);

drop policy if exists "own progress delete" on public.user_progress;
create policy "own progress delete"
  on public.user_progress for delete
  to authenticated
  using ((select auth.jwt() ->> 'sub') = user_id);

-- ---------------------------------------------------------------------------
-- FIGURE STORAGE
-- A public bucket for the official contest figures that were downloaded locally
-- rather than hotlinked. `npm run seed` uploads them and rewrites figure_img to
-- the public URL, so the app never depends on a third party serving our images.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('figures', 'figures', true)
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------------
-- MEDALS
-- The medal records HOW a problem was solved (hints spent at the moment of the
-- solve) and is kept separate from the live hint counter, so "reset and try
-- again" can clear the attempt without erasing what was already earned. A medal
-- Gold is kept permanently; silver and bronze lapse after MEDAL_TTL_DAYS, which
-- is why the timestamp is stored rather than a boolean.
-- ---------------------------------------------------------------------------

alter table public.user_progress
  add column if not exists medal text
    check (medal in ('gold', 'silver', 'bronze')),
  add column if not exists medal_at timestamptz,
  -- Wrong guesses since the last reset. Counted alongside hints when the medal
  -- is decided, so a lucky guess costs the same as peeking at a rung.
  add column if not exists wrong_attempts int not null default 0;

create index if not exists user_progress_medal_idx
  on public.user_progress (user_id, medal_at)
  where medal is not null;
