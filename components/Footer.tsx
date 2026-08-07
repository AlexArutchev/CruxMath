import Link from "next/link";

export const SUPPORT_EMAIL = "support@cruxmath.com";

export default function Footer() {
  return (
    <footer className="site-foot">
      <span>CruxMath</span>
      <Link href="/privacy">Privacy</Link>
      {/* mailto so the address is prefilled in whatever mail client the visitor uses. */}
      <a href={"mailto:" + SUPPORT_EMAIL}>Contact</a>
      <a href="https://github.com/AlexArutchev/CruxMath" target="_blank" rel="noopener noreferrer">
        Source
      </a>
    </footer>
  );
}
