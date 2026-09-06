import { hasSupabaseEnv, supabaseServer } from "@/lib/supabase/server";

export const ARCHIVE_PAGE_SIZE = 100;

export const SEO_TOPICS = [
  "3D Geometry",
  "Algebra",
  "Combinatorics",
  "Geometry",
  "Number Theory",
  "Probability",
  "Trigonometry",
] as const;

export type SeoTopic = (typeof SEO_TOPICS)[number];

export type ArchiveProblem = {
  id: string;
  contest: string;
  num: number;
  difficulty: number | null;
  tier: string | null;
  topics: string[];
  has_ladder: boolean;
};

export function topicSlug(topic: SeoTopic): string {
  return topic.toLowerCase().replace(/\s+/g, "-");
}

export function topicFromSlug(slug: string): SeoTopic | null {
  return SEO_TOPICS.find((topic) => topicSlug(topic) === slug) ?? null;
}

export function archivePageNumber(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) return 1;
  return Math.max(1, Number(value));
}

export async function loadArchiveProblems({
  page,
  topic,
}: {
  page: number;
  topic?: SeoTopic;
}): Promise<{ rows: ArchiveProblem[]; total: number } | null> {
  if (!hasSupabaseEnv()) return null;

  const sb = supabaseServer();
  let query = sb
    .from("problems")
    .select("id, contest, num, difficulty, tier, topics, has_ladder", { count: "exact" });

  if (topic) query = query.contains("topics", [topic]);

  const { data, count, error } = await query
    .order("contest", { ascending: false })
    .order("num", { ascending: true })
    .range((page - 1) * ARCHIVE_PAGE_SIZE, page * ARCHIVE_PAGE_SIZE - 1);

  if (error) {
    console.error("[cruxmath] could not build search archive:", error.message);
    return null;
  }

  return {
    rows: (data ?? []) as ArchiveProblem[],
    total: count ?? 0,
  };
}
