import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'MyBacklog — Stop scrolling. Start playing.',
  description:
    'Your Steam library has hundreds of games. MyBacklog helps you pick the right one to play tonight, track your progress, and actually finish your backlog.',
  openGraph: {
    title: 'MyBacklog — Stop scrolling. Start playing.',
    description:
      'Your Steam library has hundreds of games. MyBacklog helps you pick the right one to play tonight, track your progress, and actually finish your backlog.',
    url: 'https://mybacklog.app',
    siteName: 'MyBacklog',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MyBacklog — Stop scrolling. Start playing.',
    description:
      'Your Steam library has hundreds of games. MyBacklog helps you pick the right one to play tonight, track your progress, and actually finish your backlog.',
  },
};

export default function LandingRoute() {
  return <LandingPage user={null} />;
}
