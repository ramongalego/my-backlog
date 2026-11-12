'use client';

import { LayoutGrid, List } from 'lucide-react';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import type { GamesView } from '@/lib/games/games-view';

const OPTIONS = [
  {
    value: 'grid' as const,
    label: (
      <>
        <LayoutGrid className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">Grid</span>
      </>
    ),
  },
  {
    value: 'list' as const,
    label: (
      <>
        <List className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">List</span>
      </>
    ),
  },
];

/** The Games page's grid / list switch, beside Sort. */
export function GamesViewToggle({
  value,
  onChange,
}: {
  value: GamesView;
  onChange: (view: GamesView) => void;
}) {
  return (
    <ToggleGroup
      variant="segmented"
      size="md"
      label="View"
      options={OPTIONS}
      value={value}
      onChange={onChange}
    />
  );
}
