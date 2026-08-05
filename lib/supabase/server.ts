import { createClient } from "@supabase/supabase-js";

export function hasSupabaseEnv(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Server-side client for reading public content (problems and ladders).
 *
 * Deliberately sessionless: content is world-readable under RLS, and progress is
 * read in the browser where the anonymous session lives. That keeps auth out of
 * the render path entirely.
 */
export function supabaseServer() {
  if (!hasSupabaseEnv()) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see README)."
    );
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
