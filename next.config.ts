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
  "img-src 'self' data: blob: https://*.steamstatic.com https://steamcdn-a.akamaihd.net https://avatars.steamstatic.com https://cdn2.steamgriddb.com",
  "font-src 'self' data:",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://va.vercel-scripts.com`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const nextConfig: NextConfig = {
  reactCompiler: true,
  compiler: {
    removeConsole: {
      exclude: ['error', 'warn'],
    },
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
    // Reuse visited signed-in pages from the client router cache instead of
    // re-requesting them (and waiting on their server prefetch) on every
    // navigation. Their data lives in React Query, which mutations already
    // invalidate and which refetches each query once it's stale (see
    // lib/data/queries), so a reused page still shows current data.
    staleTimes: { dynamic: 300 },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    // One quality: every distinct (image, width, quality) is optimized and
    // billed separately.
    qualities: [90],
    // Steam's art is at most 920px wide and the optimizer never upscales, so
    // the larger default widths (1200 up to 3840) each produced the same
    // picture again as a separate variant. 1080 covers the widest frame the
    // app draws (the game dialog's art, 544px, on a 2x screen).
    deviceSizes: [640, 750, 828, 1080],
    // A month, not the default four hours. Every art URL changes when its
    // picture does (Steam's hashed paths and ?t=, IGDB and SteamGridDB ids),
    // so a cached variant never goes stale; re-optimizing each one six times
    // a day was pure cost.
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
    ],
  },
  // The public Steam roast became the player profile on Stats: old roast
  // links go to the landing page (or Home, once signed in) instead of a 404.
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

export default nextConfig;
