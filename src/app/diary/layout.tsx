import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diary',
};

export default function DiaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
