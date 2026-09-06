import Link from "next/link";
import Header from "@/components/Header";
import {
  ARCHIVE_PAGE_SIZE,
  SEO_TOPICS,
  type SeoTopic,
  topicSlug,
  loadArchiveProblems,
} from "@/lib/seo-archive";
import styles from "./SeoArchive.module.css";

function archiveHref(page: number, topic?: SeoTopic): string {
  const base = topic ? `/topics/${topicSlug(topic)}` : "/archive";
  return page === 1 ? base : `${base}?page=${page}`;
}

export default async function SeoArchive({ page, topic }: { page: number; topic?: SeoTopic }) {
  const archive = await loadArchiveProblems({ page, topic });
  const title = topic ? `${topic} Practice Problems` : "AMC & AIME Problem Archive";
  const pageCount = archive ? Math.ceil(archive.total / ARCHIVE_PAGE_SIZE) : 0;
  const isOutOfRange = archive && page > 1 && archive.rows.length === 0;

  return (
    <>
      <Header />
      <main className={styles.archive}>
        <p className={styles.eyebrow}>CRUXMATH ARCHIVE</p>
        <h1>{title}</h1>
        <p className={styles.intro}>
          Browse the CruxMath collection by topic, then open any problem to practice with
          progressive hints when you want them.
        </p>

        <nav className={styles.topics} aria-label="Problem topics">
          <Link href="/archive" className={!topic ? styles.currentTopic : undefined}>
            All problems
          </Link>
          {SEO_TOPICS.map((item) => (
            <Link
              key={item}
              href={`/topics/${topicSlug(item)}`}
              className={topic === item ? styles.currentTopic : undefined}
            >
              {item}
            </Link>
          ))}
        </nav>

        {!archive ? (
          <p className={styles.empty}>The problem archive is temporarily unavailable.</p>
        ) : isOutOfRange ? (
          <p className={styles.empty}>That archive page does not exist.</p>
        ) : (
          <>
            <p className={styles.count}>
              {archive.total} problems · page {page} of {pageCount || 1}
            </p>
            <ol className={styles.results} start={(page - 1) * ARCHIVE_PAGE_SIZE + 1}>
              {archive.rows.map((problem) => (
                <li key={problem.id}>
                  <Link href={`/problem/${problem.id}`}>
                    <strong>
                      {problem.contest} Problem {problem.num}
                    </strong>
                    <span>
                      {problem.topics.join(" · ")}
                      {problem.tier ? ` · ${problem.tier}` : ""}
                      {problem.has_ladder ? " · hints available" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
            <nav className={styles.pagination} aria-label="Archive pages">
              {page > 1 ? <Link href={archiveHref(page - 1, topic)}>Previous</Link> : <span />}
              {page < pageCount ? <Link href={archiveHref(page + 1, topic)}>Next</Link> : <span />}
            </nav>
          </>
        )}
      </main>
    </>
  );
}
