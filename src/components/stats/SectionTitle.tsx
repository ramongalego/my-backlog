'use client';

import { SectionLabel } from '@/components/layout/Page';

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <SectionLabel className="mb-4">{children}</SectionLabel>;
}
