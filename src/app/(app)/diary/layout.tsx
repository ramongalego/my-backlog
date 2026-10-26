import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diary',
  description: "Every game you've finished, with the date, your rating and your notes.",
};

export default function DiaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
