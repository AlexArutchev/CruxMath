import Link from "next/link";

/**
 * The wordmark is the way home. SOLVE and LIBRARY were separate tabs pointing at
 * the same place, so the nav is just PROGRESS now.
 */
export default function Header({ active }: { active?: "library" | "progress" }) {
  return (
    <header>
      <div className="brand">
        <Link className="wordmark" href="/browse">
          CRUXMATH
        </Link>
        <Link
          className={"mono nav" + (active === "progress" ? " on" : "")}
          href="/progress"
        >
          PROGRESS
        </Link>
      </div>
    </header>
  );
}
