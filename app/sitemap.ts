import type { MetadataRoute } from "next";

const SITE_URL = "https://www.cruxmath.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // `/` redirects to `/browse`, so only the final, indexable URL belongs
    // here. Listing both sends Google conflicting canonical signals.
    { url: `${SITE_URL}/browse`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
