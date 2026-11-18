import path from "node:path";
import type { NextConfig } from "next";

// CSP notes:
// - script-src 'unsafe-inline': Next.js App Router streams page data through
//   inline scripts (self.__next_f.push) whose content changes per page, so a
//   hash can't cover them; a per-request nonce would need middleware. External
//   scripts are still blocked. The only hand-written inline script is the
//   static theme script in app/layout.tsx.
// - style-src-attr 'unsafe-inline': React inline style={{...}} attributes
//   (progress bars, dynamic colors) and Radix/sonner runtime positioning
//   need it; <style> elements stay blocked (style-src 'self').
// - connect-src: the browser Supabase client (lib/supabase-browser.ts,
//   Google sign-in via Supabase Auth) talks to the proofcode Supabase
//   project over https (wss listed for the same host; no realtime channels
//   are subscribed today). All other browser fetches hit same-origin
//   /api/v1 routes; the service-role Supabase client (lib/api/supabase.ts)
//   is server-side only, as are the OpenRouter/Gemini calls in
//   lib/api/fixer.ts.
const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self'",
      "style-src-attr 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self'",
      "connect-src 'self' https://vjeuayolhsrovjiibhpn.supabase.co wss://vjeuayolhsrovjiibhpn.supabase.co",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'none'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: path.join(__dirname),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
