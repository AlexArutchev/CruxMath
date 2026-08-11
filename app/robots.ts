import type { MetadataRoute } from "next";

const SITE_URL = "https://www.cruxmath.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // This page reflects a visitor's own saved progress rather than a
      // reusable learning resource.
      disallow: "/progress",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
