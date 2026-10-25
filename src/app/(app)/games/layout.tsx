import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Games',
  description:
    'Browse and manage your Steam library. Filter by status, search by name or tag, and update your backlog.',
};

export default function GamesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
