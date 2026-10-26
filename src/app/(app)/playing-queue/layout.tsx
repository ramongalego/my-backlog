import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Queue',
  description: "The game you're playing and the ones lined up after it.",
};

export default function PlayingQueueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
