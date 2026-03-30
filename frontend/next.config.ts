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
  async rewrites() {
    // BACKEND_URL must be a valid base URL without a trailing slash,
    // e.g. "http://backend:8000" (set in docker-compose.yml).
    const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
