/**
 * Load content into Supabase from the local build output.
 *
 * The ladder pipeline and its source markdown deliberately stay OUT of this
 * repo. This script reads whatever `npm run build:content` produced in the
 * vault (data.js + ladders.js) and upserts it, so the public repo never carries
 * the corpus while the deployed site still has it.
 *
 *   npm run seed              # uses CRUX_CONTENT_DIR from .env
 *   npm run seed -- --dry     # parse and report, write nothing
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY: content tables are readable by everyone
 * but writable only by the service role.
 */
import fs from "node:fs";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const DRY = process.argv.includes("--dry");
const CONTENT_DIR = process.env.CRUX_CONTENT_DIR ?? "../crux-journal";
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type RawProblem = {
  id: string; contest: string; num: number; statement: string;
  answer: string | null; difficulty: number | null; tier: string | null;
  topics: string[] | null; hasLadder: boolean; figureImg: string | null;
};
type RawLadder = {
  title: string | null; approach: string | null;
  rungs: { title: string; bodyHtml: string }[]; reviewHtml: string | null;
};

/** The build output assigns onto `window`; evaluate it and take the globals. */
function readGlobals(file: string, key: string): unknown {
  const src = fs.readFileSync(file, "utf8");
  const fn = new Function("window", src + "\n;return window;");
  const w = fn({}) as Record<string, unknown>;
  const value = w[key];
  if (!value) throw new Error(`${path.basename(file)} did not define window.${key}`);
  return value;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Figures that were downloaded locally carry a relative path like
 * "figures/2024-aime-i-5.png". Upload those to the public bucket and hand back
 * the public URL. Already-remote URLs are left alone.
 */
async function uploadFigures(
  sb: SupabaseClient,
  rows: { id: string; figure_img: string | null }[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const local = rows.filter((r) => r.figure_img && !/^https?:/i.test(r.figure_img));
  if (!local.length) return out;

  // Create the bucket on first run so setup stays a single command.
  const { error: bucketErr } = await sb.storage.createBucket("figures", { public: true });
  if (bucketErr && !/exist/i.test(bucketErr.message)) {
    throw new Error("could not create figures bucket: " + bucketErr.message);
  }

  let n = 0;
  for (const r of local) {
    const rel = r.figure_img as string;
    const file = path.resolve(CONTENT_DIR, rel);
    if (!fs.existsSync(file)) {
      console.warn(`\n  WARNING: figure missing on disk for ${r.id}: ${rel}`);
      continue;
    }
    const key = path.basename(rel);
    const { error } = await sb.storage
      .from("figures")
      .upload(key, fs.readFileSync(file), { contentType: "image/png", upsert: true });
    if (error) throw new Error(`figure upload failed for ${r.id}: ${error.message}`);
    const { data } = sb.storage.from("figures").getPublicUrl(key);
    out.set(r.id, data.publicUrl);
    n += 1;
    process.stdout.write(`\r  figures uploaded:  ${n}/${local.length}`);
  }
  if (n) process.stdout.write("\n");
  return out;
}

async function main() {
  const dataFile = path.resolve(CONTENT_DIR, "data.js");
  const ladderFile = path.resolve(CONTENT_DIR, "ladders.js");
  for (const f of [dataFile, ladderFile]) {
    if (!fs.existsSync(f)) {
      throw new Error(
        `Missing ${f}. Set CRUX_CONTENT_DIR to the folder holding data.js and ladders.js.`
      );
    }
  }

  const problems = readGlobals(dataFile, "PROBLEMS") as RawProblem[];
  const ladders = readGlobals(ladderFile, "LADDERS") as Record<string, RawLadder>;

  const problemRows = problems.map((p) => ({
    id: p.id,
    contest: p.contest,
    num: p.num,
    statement: p.statement,
    answer: p.answer ?? null,
    difficulty: p.difficulty ?? null,
    tier: p.tier ?? null,
    topics: p.topics ?? [],
    figure_img: p.figureImg ?? null,
    has_ladder: !!p.hasLadder,
    updated_at: new Date().toISOString(),
  }));

  const known = new Set(problemRows.map((p) => p.id));
  const orphans = Object.keys(ladders).filter((id) => !known.has(id));
  const ladderRows = Object.entries(ladders)
    .filter(([id]) => known.has(id))
    .map(([id, l]) => ({
      problem_id: id,
      title: l.title ?? null,
      approach: l.approach ?? null,
      rungs: l.rungs ?? [],
      review_html: l.reviewHtml ?? null,
      updated_at: new Date().toISOString(),
    }));

  console.log(`problems: ${problemRows.length}`);
  console.log(`ladders:  ${ladderRows.length}${orphans.length ? `  (skipped ${orphans.length} with no matching problem: ${orphans.slice(0, 3).join(", ")}...)` : ""}`);
  console.log(`flagged has_ladder: ${problemRows.filter((p) => p.has_ladder).length}`);
  const noAnswer = problemRows.filter((p) => !p.answer);
  if (noAnswer.length) {
    console.log(`WARNING: ${noAnswer.length} problem(s) have no answer and cannot be graded: ${noAnswer.map((p) => p.id).join(", ")}`);
  }

  if (DRY) {
    console.log("\n--dry: nothing written.");
    return;
  }
  if (!URL || !SERVICE_KEY) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set to write.");
  }

  const sb = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });

  const figureUrls = await uploadFigures(sb, problemRows);
  for (const row of problemRows) {
    const url = figureUrls.get(row.id);
    if (url) row.figure_img = url;
  }

  // Problems first: ladders reference them by foreign key.
  let done = 0;
  for (const batch of chunk(problemRows, 500)) {
    const { error } = await sb.from("problems").upsert(batch, { onConflict: "id" });
    if (error) throw new Error("problems upsert failed: " + error.message);
    done += batch.length;
    process.stdout.write(`\r  problems upserted: ${done}/${problemRows.length}`);
  }
  process.stdout.write("\n");

  done = 0;
  for (const batch of chunk(ladderRows, 200)) {
    const { error } = await sb.from("ladders").upsert(batch, { onConflict: "problem_id" });
    if (error) throw new Error("ladders upsert failed: " + error.message);
    done += batch.length;
    process.stdout.write(`\r  ladders upserted:  ${done}/${ladderRows.length}`);
  }
  process.stdout.write("\n");

  const [{ count: pc }, { count: lc }] = await Promise.all([
    sb.from("problems").select("*", { count: "exact", head: true }),
    sb.from("ladders").select("*", { count: "exact", head: true }),
  ]);
  console.log(`\nin database now: ${pc} problems, ${lc} ladders`);
}

main().catch((e) => {
  console.error("\nseed failed:", e.message);
  process.exit(1);
});
