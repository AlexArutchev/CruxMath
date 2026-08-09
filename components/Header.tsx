import Link from "next/link";

/**
 * The wordmark is the way home. SOLVE and LIBRARY were separate tabs pointing at
 * the same place, so the nav is just PROGRESS now.
 *
 * `context` fills the header's right slot on mobile, where the solve page gives
 * its answer row up to the bottom sheet and the meta line is the first thing to
 * scroll away. Hidden above the mobile breakpoint, so the desktop header that
 * the handoff calls final is untouched.
 */
export default function Header({
  active,
  context,
}: {
  active?: "library" | "progress";
  context?: string;
}) {
  return (
    <header>
      <div className="brand">
        {/* Split so the two halves can take different ink. Still one word: at
            .2em tracking a real word space opens a gap wide enough to read as
            two separate things, and the colour break already separates them. */}
        <Link className="wordmark" href="/browse">
          <span className="wm-crux">CRUX</span>MATH
        </Link>
        <Link
          className={"mono nav" + (active === "progress" ? " on" : "")}
          href="/progress"
        >
          PROGRESS
        </Link>
      </div>
      {context && <span className="mono hd-ctx">{context}</span>}
    </header>
  );
}
