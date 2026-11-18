import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : '*.supabase.co';

const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is required for Next.js inline scripts (hydration, JSON-LD).
  // 'unsafe-eval' is only needed in dev for React Refresh / HMR.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  // Art is served resized from this site, but a picture that fails that way
  // falls back to its source (GameArt), and the art picker shows SteamGridDB's.
  `img-src 'self' data: blob: https://*.steamstatic.com https://steamcdn-a.akamaihd.net https://avatars.steamstatic.com https://cdn2.steamgriddb.com https://images.igdb.com https://${supabaseHost}/storage/v1/object/public/avatars/`,
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://va.vercel-scripts.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Read by lib/sentry/options.ts, in the browser too: Sentry only sends from
  // Vercel's production and preview deploys.
  env: { NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.VERCEL_ENV ?? '' },
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Reused pages still show current data: it lives in React Query, which
    // mutations invalidate and which refetches stale queries (lib/data/queries).
    staleTimes: { dynamic: 300 },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // One quality: every distinct (image, width, quality) is optimized and
    // billed separately.
    qualities: [90],
    // Steam's art is at most 920px and the optimizer never upscales, so wider
    // sizes only duplicate it. 1080 covers the dialog's 544px art at 2x.
    deviceSizes: [640, 750, 828, 1080],
    // Seconds (a month): every art URL changes when its picture does, so a
    // cached variant never goes stale.
    minimumCacheTTL: 2678400,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net',
      },
      // Art for games added by hand.
      {
        protocol: 'https',
        hostname: 'images.igdb.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn2.steamgriddb.com',
      },
      // Profile pictures the player uploaded (the avatars storage bucket).
      {
        protocol: 'https',
        hostname: supabaseHost,
        pathname: '/storage/v1/object/public/avatars/**',
      },
    ],
  },
  // Old roast links go to the landing page (or Home, once signed in), not a 404.
  redirects: async () => [
    { source: '/roast', destination: '/', permanent: true },
    { source: '/roast/:path*', destination: '/', permanent: true },
  ],
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

const onVercel = !!process.env.VERCEL;

export default withSentryConfig(nextConfig, {
  org: 'mybacklog-75',
  project: 'my-backlog',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  // Source maps for readable stack traces, uploaded from Vercel's builds only:
  // a local build sends nothing.
  sourcemaps: { disable: !onVercel },
  widenClientFileUpload: true,
  release: { create: onVercel, setCommits: false },
  // Must stay out of proxy.ts's matcher, which would check sign-in on every report.
  tunnelRoute: '/monitoring',
  bundleSizeOptimizations: { excludeDebugStatements: true },
  // A Sentry upload that fails warns instead of failing the deploy.
  errorHandler: (err) => console.warn('Sentry upload failed:', err),
});
