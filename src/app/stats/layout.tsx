import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Stats',
  description:
    'Your gaming statistics at a glance. Completion rates, playtime breakdowns, rating distribution, and top tags.',
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
