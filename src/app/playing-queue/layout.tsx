import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Queue',
};

export default function PlayingQueueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
