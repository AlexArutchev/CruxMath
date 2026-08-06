import type { Metadata } from "next";
import { Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "katex/dist/katex.min.css";
import "./globals.css";
import Footer from "@/components/Footer";

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
        {children}
        <Footer />
        <Analytics />
      </body>
    </html>
  );
}
