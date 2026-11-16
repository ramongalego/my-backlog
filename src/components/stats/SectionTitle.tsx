'use client';

import { SectionLabel } from '@/components/layout/Page';

export function SectionTitle({
  children,
  id,
}: {
  children: React.ReactNode;
  /** Lets the heading take focus from script (see SectionLabel). */
  id?: string;
}) {
  return (
    <SectionLabel id={id} className="mb-4">
      {children}
    </SectionLabel>
  );
}
