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
  "img-src 'self' data: blob: https://*.steamstatic.com https://steamcdn-a.akamaihd.net https://avatars.steamstatic.com",
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
    // invalidate, so this matches the queries' 5-minute staleTime.
    staleTimes: { dynamic: 300 },
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    qualities: [90, 95],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.steamstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'steamcdn-a.akamaihd.net',
      },
    ],
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: csp },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
};

export default nextConfig;
