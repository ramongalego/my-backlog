import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';
import { getBaseUrl } from '@/lib/url';

const OG_IMAGE = {
  url: '/opengraph-image',
  width: 1200,
  height: 630,
  alt: 'MyBacklog: Play the games you already own',
};

export const metadata: Metadata = {
  // absolute: this page sits under the root layout's '%s · MyBacklog' template.
  title: { absolute: 'MyBacklog · Play the games you already own' },
  description:
    'MyBacklog imports your Steam library or the games you add from any console, suggests what to play next from the games you already own, and keeps a diary of the ones you finish.',
  openGraph: {
    title: 'MyBacklog · Play the games you already own',
    description:
      'MyBacklog imports your Steam library or the games you add from any console, suggests what to play next from the games you already own, and keeps a diary of the ones you finish.',
    url: getBaseUrl(),
    siteName: 'MyBacklog',
    type: 'website',
    // Set here because this block replaces the root one, file-based image
    // (app/opengraph-image.tsx) included: without it, links have no preview.
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    images: [OG_IMAGE],
    title: 'MyBacklog · Play the games you already own',
    description:
      'MyBacklog imports your Steam library or the games you add from any console, suggests what to play next from the games you already own, and keeps a diary of the ones you finish.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MyBacklog',
  url: getBaseUrl(),
  description:
    'Track your game backlog from Steam and any console, pick what to play next from the games you own, and log the ones you finish.',
  applicationCategory: 'GameApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};

export default function LandingRoute() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingPage />
    </>
  );
}
