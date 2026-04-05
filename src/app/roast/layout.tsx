import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Roast My Steam',
  description:
    'Paste your Steam profile link and get a brutally funny AI roast of your gaming habits.',
};

export default function RoastLayout({ children }: { children: React.ReactNode }) {
  return children;
}
