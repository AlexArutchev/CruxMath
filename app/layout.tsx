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

export const metadata: Metadata = {
  title: { default: "CruxMath", template: "%s | CruxMath" },
  description:
    "Competition math practice built around hint ladders: each rung says why you would think of the move, not just the move.",
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
