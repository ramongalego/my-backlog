import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Steam Profile Roaster',
  description:
    'Paste a Steam profile link and get a savage AI-generated roast of their gaming habits. Free and instant.',
  openGraph: {
    title: 'Steam Profile Roaster',
    description:
      'Paste a Steam profile link and get a savage AI-generated roast of their gaming habits.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Steam Profile Roaster',
    description:
      'Paste a Steam profile link and get a savage AI-generated roast of their gaming habits.',
  },
};

export default function RoastLayout({ children }: { children: React.ReactNode }) {
  return children;
}
