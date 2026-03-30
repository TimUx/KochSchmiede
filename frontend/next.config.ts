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
  // NOTE: Do NOT add rewrites for /api/* here.
  // next.config.ts rewrites are compiled at build time, so BACKEND_URL would
  // be baked in as the build-time value (defaulting to localhost:8000) rather
  // than the runtime docker-compose value (http://backend:8000).
  // Additionally, default rewrites take precedence over dynamic catch-all route
  // handlers in Next.js routing, which would bypass app/api/[...path]/route.ts.
  // All /api/* requests are proxied by app/api/[...path]/route.ts at runtime.
};

export default nextConfig;
