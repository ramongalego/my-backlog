import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  // absolute: this page sits under the root layout's '%s · MyBacklog' template.
  title: { absolute: 'MyBacklog · Play the games you already own' },
  description:
    'MyBacklog imports your Steam library or the games you add from any console, suggests what to play next from the games you already own, and keeps a diary of the ones you finish.',
  openGraph: {
    title: 'MyBacklog · Play the games you already own',
    description:
      'MyBacklog imports your Steam library or the games you add from any console, suggests what to play next from the games you already own, and keeps a diary of the ones you finish.',
    url: 'https://mybacklog.app',
    siteName: 'MyBacklog',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyBacklog · Play the games you already own',
    description:
      'MyBacklog imports your Steam library or the games you add from any console, suggests what to play next from the games you already own, and keeps a diary of the ones you finish.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MyBacklog',
  url: 'https://mybacklog.app',
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
