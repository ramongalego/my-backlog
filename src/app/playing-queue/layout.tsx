import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Queue',
  description:
    'Your playing queue. Drag and reorder upcoming games so you always know what to play next.',
};

export default function PlayingQueueLayout({ children }: { children: React.ReactNode }) {
  return children;
}
