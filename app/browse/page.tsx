import Header from "@/components/Header";
import BrowseClient from "@/components/BrowseClient";
import Tour from "@/components/Tour";
import { supabaseServer, hasSupabaseEnv } from "@/lib/supabase/server";

// This is the URL that actually gets shared, so the preview has to stand alone.
// "Library" told a stranger nothing.
export const metadata = {
  title: "AMC & AIME Practice Problems with Hints",
  openGraph: { title: "AMC & AIME Practice Problems with Hints" },
};

// Facet lists change only when content is reseeded.
export const revalidate = 3600;

async function facets() {
  // Build the filter rail if we can. Without config, still render the page so a
  // fresh clone builds; the warning below says exactly what is missing.
  if (!hasSupabaseEnv()) {
    console.warn(
      "[cruxmath] Supabase not configured, filter rail will be empty. See README."
    );
    return { contests: [], tiers: [], topics: [], total: 0 };
  }
  const sb = supabaseServer();
  // Small projection over the corpus: enough to build the filter rail without
  // shipping statements to the client.
  // Same 1000-row cap applies here: without an explicit range the filter rail
  // would quietly omit facets from the tail of the corpus.
  const [{ count }, { data, error }] = await Promise.all([
    sb.from("problems").select("*", { count: "exact", head: true }),
    sb.from("problems").select("contest, tier, topics").range(0, 9999),
  ]);
  if (error) {
    // An empty filter rail is a misconfiguration, not a legitimately empty
    // corpus. Say so in the build/server log instead of rendering nothing.
    console.error("[cruxmath] could not load filter facets:", error.message);
  }
  const rows = (data ?? []) as { contest: string; tier: string | null; topics: string[] }[];

  const contests = Array.from(new Set(rows.map((r) => r.contest))).sort().reverse();
  const tiers = Array.from(new Set(rows.map((r) => r.tier).filter(Boolean) as string[])).sort();
  const topics = Array.from(new Set(rows.flatMap((r) => r.topics ?? []))).sort();
  return { contests, tiers, topics, total: count ?? 0 };
}

export default async function BrowsePage() {
  const { contests, tiers, topics, total } = await facets();
  return (
    <>
      <Header active="library" />
      <BrowseClient contests={contests} tiers={tiers} topics={topics} archiveTotal={total} />
      {/* The library is the landing surface, since / redirects here. The tour
          renders over it and does not wait on the problem query, so a first
          visit has something to read while the list loads behind the scrim. */}
      <Tour />
    </>
  );
}
