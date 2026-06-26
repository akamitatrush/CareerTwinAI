/** @type {import('next').NextConfig} */
// CSP fica no middleware (com nonce por requisicao). Aqui apenas os headers
// que sao seguros como estaticos.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    // /site era a rota original do landing premium (Aragorn). Promovemos pra /
    // via route group (landing). Estes redirects evitam 404 em links externos
    // que ainda apontem pra /site (compartilhamentos, marketing, e-mails).
    return [
      { source: "/site", destination: "/", permanent: true },
      { source: "/site/:path*", destination: "/:path*", permanent: true },
    ];
  },
};

let exported = nextConfig;

if (process.env.SENTRY_ORG && process.env.SENTRY_PROJECT) {
  const { withSentryConfig } = await import("@sentry/nextjs");
  exported = withSentryConfig(nextConfig, {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    silent: true,
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    disableLogger: true,
  });
}

export default exported;
