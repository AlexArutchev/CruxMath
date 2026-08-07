import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "katex/dist/katex.min.css";
import "./globals.css";
import Footer from "@/components/Footer";
import { TOUR_NOFLASH } from "@/components/Tour";

// Self-hosted at build time: no render-blocking request to a third party, and
// no visitor IP handed to Google on every page load.
const serif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-mono",
});

/** One sentence, and it is the first thing anyone sees when the link is pasted
 *  into Discord or a group chat, so it has to sound like a person wrote it. */
const DESCRIPTION =
  "AMC and AIME practice with hints that come one at a time, so you can get unstuck without seeing the whole solution.";

export const metadata: Metadata = {
  // Absolute URLs for the link preview. Without this Next warns and og:url
  // resolves against nothing.
  metadataBase: new URL("https://www.cruxmath.com"),
  title: { default: "CruxMath", template: "%s | CruxMath" },
  description: DESCRIPTION,
  // Set explicitly: with no og tags a Discord unfurl falls back to <title>,
  // which on the shared /browse link read "Library | CruxMath".
  openGraph: {
    type: "website",
    siteName: "CruxMath",
    url: "/",
    title: { default: "CruxMath", template: "%s | CruxMath" },
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary",
    title: { default: "CruxMath", template: "%s | CruxMath" },
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={serif.variable + " " + mono.variable}>
      <body>
        {/* First thing in the body so it runs before the tour markup below is
            parsed. The tour ships visible in the server HTML so a new visitor
            gets it on the first frame; this is what stops everyone else seeing
            a flash of it on every page load. */}
        <script dangerouslySetInnerHTML={{ __html: TOUR_NOFLASH }} />
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
