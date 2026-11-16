import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Profile',
  description: 'Your favorite games, what you have been playing, and your account.',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return children;
}
