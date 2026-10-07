import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (local-dev Postgres) ships WASM; load it from node_modules instead of bundling.
  serverExternalPackages: ["@electric-sql/pglite"],
  // The app runs inside a HighLevel iframe (Custom Page), so it must be frameable
  // by HighLevel domains (including white-label agency domains → allow any https origin).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self' https:" }],
      },
      {
        // Public assets are loaded from customer funnel domains.
        source: "/(loader.js|runtime.js|runtime.css|runtime/.*)",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400" },
        ],
      },
    ];
  },
};

export default nextConfig;
