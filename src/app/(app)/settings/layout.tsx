import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Your username, email and password, your Steam connection and your data.',
};

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
