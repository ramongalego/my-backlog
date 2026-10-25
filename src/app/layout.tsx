import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Schibsted_Grotesk } from 'next/font/google';
import { Toaster } from 'sonner';
import { Analytics } from '@vercel/analytics/next';
import { Footer } from '@/components/Footer';
import { UrlErrorToast } from '@/components/UrlErrorToast';
import { getBaseUrl } from '@/lib/url';
import './globals.css';

const sans = Schibsted_Grotesk({
  variable: '--font-sans-face',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    template: '%s · MyBacklog',
    default: 'MyBacklog',
  },
  description:
    'Stop buying new games and start finishing the ones you own. MyBacklog helps you pick the perfect game from your Steam library.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${sans.variable} font-sans antialiased bg-ink-950 text-ink-100`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-accent-500 focus:text-ink-950 focus:px-4 focus:py-2 focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        {/* The app shell (React Query, auth-aware header, library sync) lives in
            the (app) group layout so the marketing pages don't ship it. */}
        {children}
        <Footer />
        <Toaster richColors position="bottom-right" />
        <Suspense>
          <UrlErrorToast />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}
