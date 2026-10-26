import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stats',
  description:
    "How much of your library you've played and finished, how you rate games, and how long the backlog would take.",
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
