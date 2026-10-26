'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAddGame } from './AddGameProvider';

/** The header's Add game button, so a game outside Steam can be added from any page. */
export function AddGameButton() {
  const { open } = useAddGame();
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => open()}
      aria-label="Add game"
      // A 40px touch target on phones, where the label is hidden.
      className="max-sm:h-10 max-sm:w-10 max-sm:px-0"
    >
      <Plus className="w-4 h-4" aria-hidden="true" />
      <span className="hidden sm:inline">Add game</span>
    </Button>
  );
}
