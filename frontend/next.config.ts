import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    // Recipe images can originate from any website the user imports from.
    // This is intentional for a self-hosted recipe platform.
    // Restrict to HTTPS-only to avoid mixed-content issues.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default nextConfig;
