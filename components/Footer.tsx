import Link from "next/link";

export const SUPPORT_EMAIL = "support@cruxmath.com";

export default function Footer() {
  return (
    <footer className="site-foot">
      {/* One template string rather than an entity next to an expression, so
          JSX cannot introduce whitespace of its own. No space after the symbol
          on purpose: .site-foot is monospaced with .12em tracking, so a real
          space renders as a full character cell plus tracking and reads as a
          gap. The tracking alone separates them.

          Year is stamped at render, which for the prerendered routes means
          build time, so it advances on the next deploy rather than at midnight
          on the 1st. Close enough for a footer, and it beats a hardcoded year
          that goes quietly stale. */}
      <span>{`©${new Date().getFullYear()} CruxMath`}</span>
      <Link href="/privacy">Privacy</Link>
      {/* mailto so the address is prefilled in whatever mail client the visitor uses. */}
      <a href={"mailto:" + SUPPORT_EMAIL}>Contact</a>
      <a href="https://github.com/AlexArutchev/CruxMath" target="_blank" rel="noopener noreferrer">
        Source
      </a>
    </footer>
  );
}
