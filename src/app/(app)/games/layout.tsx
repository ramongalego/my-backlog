import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Games',
  description: 'Your whole library. Filter by status, search by name or tag, and update any game.',
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
