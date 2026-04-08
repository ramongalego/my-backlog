import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
  description:
    "Your gaming dashboard. See what you're currently playing, pick your next game, and track your backlog progress.",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
