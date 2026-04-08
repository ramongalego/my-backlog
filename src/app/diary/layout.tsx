import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Diary',
  description:
    "Your completed games journal. See every game you've finished, when you beat it, and how you rated it.",
};

export default function DiaryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
