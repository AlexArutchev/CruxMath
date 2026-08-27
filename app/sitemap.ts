import type { MetadataRoute } from "next";
import { hasSupabaseEnv, supabaseServer } from "@/lib/supabase/server";

const SITE_URL = "https://www.cruxmath.com";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/amc-10`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/amc-12`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/aime`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  if (!hasSupabaseEnv()) return staticPages;
  const sb = supabaseServer();
  const problems: { id: string; updated_at: string }[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    // PostgREST caps each response at 1,000 rows in this project. Paginate so
    // the sitemap includes the whole corpus, not only the first thousand ids.
    const { data, error } = await sb
      .from("problems")
      .select("id, updated_at")
      .range(from, from + pageSize - 1);
    if (error) {
      console.error("[cruxmath] could not build problem sitemap:", error.message);
      return staticPages;
    }
    const batch = (data ?? []) as { id: string; updated_at: string }[];
    problems.push(...batch);
    if (batch.length < pageSize) break;
  }
  return [
    ...staticPages,
    ...problems.map((problem) => ({
      url: `${SITE_URL}/problem/${problem.id}`,
      lastModified: problem.updated_at,
      changeFrequency: "yearly" as const,
      priority: 0.7,
    })),
  ];
}
