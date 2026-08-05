import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Official contest figures are served straight from the AoPS CDN.
    remotePatterns: [
      { protocol: "https", hostname: "latex.artofproblemsolving.com" },
      { protocol: "https", hostname: "artofproblemsolving.com" },
    ],
  },
};

export default nextConfig;
