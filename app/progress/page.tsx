import Header from "@/components/Header";
import ProgressClient from "@/components/ProgressClient";
import { supabaseServer, hasSupabaseEnv } from "@/lib/supabase/server";

export const metadata = { title: "Progress" };

// Archive totals change only when content is reseeded.
export const revalidate = 3600;

async function archive() {
  if (!hasSupabaseEnv()) {
    console.warn("[cruxmath] Supabase not configured, archive totals unavailable.");
    return { total: 0, byGroup: {} as Record<string, number>, topics: [] as string[] };
  }
  const sb = supabaseServer();

  // PostgREST caps a plain select() at 1000 rows, so totals have to come from
  // count queries rather than from counting what came back.
  const [all, amc10, amc12, aime, topicRows] = await Promise.all([
    sb.from("problems").select("*", { count: "exact", head: true }),
    sb.from("problems").select("*", { count: "exact", head: true }).ilike("contest", "%AMC 10%"),
    sb.from("problems").select("*", { count: "exact", head: true }).ilike("contest", "%AMC 12%"),
    sb.from("problems").select("*", { count: "exact", head: true }).ilike("contest", "%AIME%"),
    sb.from("problems").select("topics").range(0, 9999),
  ]);
  if (all.error) console.error("[cruxmath] archive totals failed:", all.error.message);

  const byGroup: Record<string, number> = {
    "AMC 10": amc10.count ?? 0,
    "AMC 12": amc12.count ?? 0,
    AIME: aime.count ?? 0,
  };
  const topics = Array.from(
    new Set(((topicRows.data ?? []) as { topics: string[] }[]).flatMap((r) => r.topics ?? []))
  ).sort();
  return { total: all.count ?? 0, byGroup, topics };
}

export default async function ProgressPage() {
  const { total, byGroup, topics } = await archive();
  return (
    <>
      <Header active="progress" />
      <ProgressClient archiveTotal={total} archiveByGroup={byGroup} allTopics={topics} />
    </>
  );
}
