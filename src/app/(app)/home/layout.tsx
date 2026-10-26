import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Home',
  description: "The game you're playing now, and help choosing the next one from your backlog.",
};

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
