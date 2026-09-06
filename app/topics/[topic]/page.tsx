import { notFound } from "next/navigation";
import type { Metadata } from "next";
import SeoArchive from "@/components/SeoArchive";
import {
  archivePageNumber,
  SEO_TOPICS,
  topicFromSlug,
  topicSlug,
} from "@/lib/seo-archive";

export const revalidate = 3600;

type TopicPageProps = {
  params: Promise<{ topic: string }>;
  searchParams: Promise<{ page?: string }>;
};

export function generateStaticParams() {
  return SEO_TOPICS.map((topic) => ({ topic: topicSlug(topic) }));
}

export async function generateMetadata({ params, searchParams }: TopicPageProps): Promise<Metadata> {
  const topic = topicFromSlug((await params).topic);
  if (!topic) return { title: "Topic not found" };
  const page = archivePageNumber((await searchParams).page);
  const suffix = page === 1 ? "" : `, Page ${page}`;
  const canonical = `/topics/${topicSlug(topic)}${page === 1 ? "" : `?page=${page}`}`;
  return {
    title: `${topic} Practice Problems${suffix}`,
    description: `Practice AMC and AIME ${topic.toLowerCase()} problems with progressive hints.`,
    alternates: { canonical },
  };
}

export default async function TopicPage({ params, searchParams }: TopicPageProps) {
  const topic = topicFromSlug((await params).topic);
  if (!topic) notFound();
  const page = archivePageNumber((await searchParams).page);
  return <SeoArchive page={page} topic={topic} />;
}
