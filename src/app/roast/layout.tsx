import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Steam Profile Roaster',
  description:
    'Paste a Steam profile link and get a savage roast of their gaming habits',
};

export default function RoastLayout({ children }: { children: React.ReactNode }) {
  return children;
}
