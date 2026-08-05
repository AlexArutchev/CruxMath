import Link from "next/link";

export default function Header({ active }: { active: "solve" | "library" }) {
  return (
    <header>
      <div className="brand">
        <span className="wordmark">CRUXMATH</span>
        <Link className={`mono nav${active === "solve" ? " on" : ""}`} href="/browse">
          SOLVE
        </Link>
        <Link className={`mono nav${active === "library" ? " on" : ""}`} href="/browse">
          LIBRARY
        </Link>
      </div>
    </header>
  );
}
