import type { Metadata } from "next";
import SeoArchive from "@/components/SeoArchive";
import { archivePageNumber } from "@/lib/seo-archive";

export const revalidate = 3600;

type ArchivePageProps = { searchParams: Promise<{ page?: string }> };

function canonical(page: number): string {
  return page === 1 ? "/archive" : `/archive?page=${page}`;
}

export async function generateMetadata({ searchParams }: ArchivePageProps): Promise<Metadata> {
  const page = archivePageNumber((await searchParams).page);
  const suffix = page === 1 ? "" : `, Page ${page}`;
  return {
    title: `AMC & AIME Problem Archive${suffix}`,
    description: "Browse AMC and AIME practice problems by topic, difficulty, and contest.",
    alternates: { canonical: canonical(page) },
  };
}

export default async function ArchivePage({ searchParams }: ArchivePageProps) {
  const page = archivePageNumber((await searchParams).page);
  return <SeoArchive page={page} />;
}
