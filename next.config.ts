import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

/**
 * Content Security Policy.
 *
 * 'unsafe-inline' on style-src is required by Tailwind's runtime style
 * injection. Scripts are NOT allowed 'unsafe-inline' in production — Next
 * emits nonced/hashed bootstrap scripts, so a stray injected <script> cannot
 * execute. In development Next's HMR client needs 'unsafe-eval'.
 */
const csp = [
  "default-src 'self'",
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  // The app talks only to its own API. Widen this only when you add a
  // third-party endpoint the browser must reach directly.
  isProd ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Clickjacking: belt-and-braces alongside frame-ancestors, for old browsers.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Two years, preload-eligible. Only sent in production — sending HSTS from
  // http://localhost would poison the browser for every other local project.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Don't advertise the framework version to attackers.
  poweredByHeader: false,

  // Trailing-slash and case variants shouldn't create duplicate URLs.
  trailingSlash: false,

  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Nothing under /api or /admin may ever be cached by a shared proxy.
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
