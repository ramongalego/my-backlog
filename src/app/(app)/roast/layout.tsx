import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Steam Roast',
  description: "Paste a Steam profile link and get a savage roast of that player's gaming habits.",
  openGraph: {
    title: 'Steam Roast',
    description:
      "Paste a Steam profile link and get a savage roast of that player's gaming habits.",
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Steam Roast',
    description:
      "Paste a Steam profile link and get a savage roast of that player's gaming habits.",
  },
};

export default function RoastLayout({ children }: { children: React.ReactNode }) {
  return children;
}
