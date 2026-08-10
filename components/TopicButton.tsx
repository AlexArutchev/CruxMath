import { saintlyLinkFor } from "@/lib/saintly-links";

/**
 * Link out to the Saintly topic article that best matches this problem.
 *
 * Rendered inside the review layer, so it only exists once the problem is
 * solved or the ladder is spent. That timing is the point: while someone is
 * still working, a page about the underlying technique is a spoiler, and
 * afterwards it is the natural next question. The review layer is where a
 * student finds out their approach was shaky, which is when reading the theory
 * actually lands.
 *
 * Nothing renders when the problem has no confident match. A third of them have
 * none, mostly advanced circle geometry, 3D solids, base representations and
 * expected value, which Saintly does not cover. A button promising a relevant
 * topic and delivering an unrelated one is worse than silence.
 *
 * No are-you-sure gate, unlike the AoPS button beside it. This gives away no
 * answer, so there is nothing to protect the reader from.
 */
export default function TopicButton({ problemId }: { problemId: string }) {
  const link = saintlyLinkFor(problemId);
  if (!link) return null;

  return (
    <div className="topic">
      <a
        className="topic-btn"
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        RELEVANT TOPIC &rarr;
      </a>
      <span className="topic-note">{link.topic}, on Saintly.</span>
    </div>
  );
}
