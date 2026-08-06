import Link from "next/link";

export default function Footer() {
  return (
    <footer className="site-foot">
      <span>CruxMath</span>
      <Link href="/privacy">Privacy</Link>
      <a href="https://github.com/AlexArutchev/CruxMath" target="_blank" rel="noopener noreferrer">
        Source
      </a>
    </footer>
  );
}
