import type { Metadata } from "next";
import Script from "next/script";
import { Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { ClerkProvider } from "@clerk/nextjs";
import "katex/dist/katex.min.css";
import "./globals.css";
import Footer from "@/components/Footer";
import { TOUR_NOFLASH } from "@/components/Tour";

/**
 * Google Analytics 4. Read from the environment rather than hardcoded: this
 * repo is public, and a baked-in measurement ID means every fork someone
 * deploys reports into the same property. Unset, the tag is not rendered at
 * all, so a clone runs with no analytics rather than with someone else's.
 *
 * Set NEXT_PUBLIC_GA_ID in Vercel's project settings for it to run in
 * production. See .env.example.
 */
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const THEME_NOFLASH = `(function(){try{var saved=localStorage.getItem('crux.theme');document.documentElement.dataset.theme=saved==='dark'?'dark':'light'}catch(_){}})()`;

// Self-hosted at build time, so rendering a page still contacts no third party
// and costs no render-blocking request. Google does see visitors now, but
// through the analytics tag below, not through a font fetch on the critical
// path.
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
  "Practice AMC and AIME problems with hint-based solutions, then track your progress by topic and difficulty.";

const ORGANIZATION_SCHEMA = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CruxMath",
  url: "https://www.cruxmath.com",
  description: DESCRIPTION,
});

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
    <html lang="en" suppressHydrationWarning className={serif.variable + " " + mono.variable}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_NOFLASH }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: ORGANIZATION_SCHEMA }}
        />
        {/* First thing in the body so it runs before the tour markup below is
            parsed. The tour ships visible in the server HTML so a new visitor
            gets it on the first frame; this is what stops everyone else seeing
            a flash of it on every page load. */}
        <script dangerouslySetInnerHTML={{ __html: TOUR_NOFLASH }} />
        <ClerkProvider
          appearance={{
            // Keep Clerk's battle-tested flow, but make its modal read like a
            // CruxMath folio rather than a generic account prompt. Direct
            // colour values keep Clerk's generated colour states compatible
            // with browsers that do not support modern CSS colour functions.
            variables: {
              colorPrimary: "#8E3B32",
              colorForeground: "#1C1A17",
              colorMutedForeground: "#6B6459",
              colorBackground: "#FBFAF7",
              colorInput: "#FBFAF7",
              colorInputForeground: "#1C1A17",
              colorDanger: "#8E3B32",
              colorSuccess: "#2F7A4D",
              borderRadius: "2px",
              fontFamily: "var(--font-serif), Georgia, serif",
              fontFamilyButtons: "var(--font-mono), ui-monospace, monospace",
            },
            elements: {
              modalBackdrop: "clerk-modal-backdrop",
              cardBox: "clerk-card-box",
              card: "clerk-card",
              headerTitle: "clerk-title",
              headerSubtitle: "clerk-subtitle",
              socialButtonsBlockButton: "clerk-social-button",
              socialButtonsBlockButtonText: "clerk-button-text",
              dividerLine: "clerk-divider-line",
              dividerText: "clerk-divider-text",
              formFieldLabel: "clerk-field-label",
              formFieldInput: "clerk-field-input",
              formButtonPrimary: "clerk-primary-button",
              footerActionText: "clerk-footer-text",
              footerActionLink: "clerk-footer-link",
              formResendCodeLink: "clerk-footer-link",
              identityPreviewText: "clerk-identity-preview",
              alertText: "clerk-alert-text",
            },
          }}
        >
          {children}
          <Footer />
          <Analytics />
        </ClerkProvider>

        {/* Google's own snippet asks for this immediately after <head>. App
            Router has no head to paste into, so next/script places it and
            defers it past hydration, which keeps a third-party request off the
            critical path. One tag, rendered once by the root layout.

            The two `allow_*` flags are deliberate. This is a study tool for
            contests that under-13s sit, so Google Signals and ads
            personalisation are refused at the tag rather than only in the
            admin console, and the privacy policy says so. They also have to
            stay off in GA's own settings; the flags here are the belt, not the
            braces. */}
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga4-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}', {
  allow_google_signals: false,
  allow_ad_personalization_signals: false
});`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
