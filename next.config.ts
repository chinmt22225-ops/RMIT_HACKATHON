import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep production builds from replacing files used by the running dev server.
  distDir: process.env.NODE_ENV === "production" ? ".next-production" : ".next",
  poweredByHeader: false,
  serverExternalPackages: ["linkedom", "@mozilla/readability"],
  // Next.js 16+ defaults to Turbopack. Use `next dev --webpack` (in package.json)
  // because @tidecloak/* packages need the webpack workarounds below.
  webpack: (config) => {
    // Fix 1: @tidecloak/js incomplete re-exports — suppress strict export checking
    config.module.strictExportPresence = false;

    // Fix 2: @tidecloak/react CJS dist contains ESM syntax.
    // Force webpack to resolve to ESM dist. Use path.resolve (not require.resolve).
    config.resolve.alias = {
      ...config.resolve.alias,
      "@tidecloak/react": path.resolve(
        __dirname,
        "node_modules/@tidecloak/react/dist/esm/index.js"
      ),
    };

    return config;
  },

  // CSP: frame-src '*' required for Tide SWE iframe (ORK re-homing).
  // Without this, login hangs silently.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: "frame-src 'self' *; object-src 'none'; base-uri 'self'",
          },
        ],
      },
      // DPoP auth page needs script-src 'unsafe-inline' for enclave.
      // Set via headers() config, NOT in a route handler — Next.js 16
      // dev server overrides CSP on route handler responses.
      {
        source: "/tide_dpop/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'unsafe-inline'",
          },
          {
            key: "Allow-CSP-From",
            value: "*",
          },
        ],
      },
    ];
  },

  // Rewrite /tide_dpop/iss/<hex>/aud/<hex>/tide_dpop_auth.html → static file.
  // Do NOT use a route handler — Next.js 16 dev injects hash-based CSP on
  // route handler responses, blocking the inline script. Static rewrites
  // are not processed through this pipeline.
  async rewrites() {
    return [
      {
        source: "/tide_dpop/:path*",
        destination: "/tide_dpop_auth.html",
      },
    ];
  },
};

export default nextConfig;
