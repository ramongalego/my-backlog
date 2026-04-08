import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'MyBacklog · Stop scrolling. Start playing.',
  description:
    'Your Steam library has hundreds of games. MyBacklog helps you pick the right one to play tonight, track your progress, and actually finish your backlog.',
  openGraph: {
    title: 'MyBacklog · Stop scrolling. Start playing.',
    description:
      'Your Steam library has hundreds of games. MyBacklog helps you pick the right one to play tonight, track your progress, and actually finish your backlog.',
    url: 'https://mybacklog.app',
    siteName: 'MyBacklog',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyBacklog · Stop scrolling. Start playing.',
    description:
      'Your Steam library has hundreds of games. MyBacklog helps you pick the right one to play tonight, track your progress, and actually finish your backlog.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MyBacklog',
  url: 'https://mybacklog.app',
  description:
    'Stop buying new games and start finishing the ones you own. MyBacklog helps you pick the perfect game from your Steam library.',
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
      <LandingPage user={null} />
    </>
  );
}
