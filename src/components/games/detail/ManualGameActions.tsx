'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';

/**
 * Under a console game's dialog: send a Steam game moved to a console back to
 * Steam, or remove a game added by hand. Each asks first.
 */
export function ManualGameActions({
  onMoveToSteam,
  onDelete,
  onClose,
}: {
  onMoveToSteam?: () => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const run = (action?: () => void) => () => {
    onClose();
    action?.();
  };

  if (onMoveToSteam) {
    return confirming ? (
      // Outlined rather than filled, so its (filled) button stands out.
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink-700 px-3 py-2.5">
        <p className="text-sm text-ink-200">
          Play it on Steam again? Steam&rsquo;s hours replace the ones you entered.
        </p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <Button variant="secondary" size="sm" onClick={run(onMoveToSteam)}>
            Move to Steam
          </Button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer mx-auto block text-sm text-ink-400 hover:text-ink-100 transition-colors"
      >
        Play on Steam instead
      </button>
    );
  }

  if (onDelete) {
    return confirming ? (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ink-800 px-3 py-2.5">
        <p className="text-sm text-ink-200">Remove it from your library?</p>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
            Keep
          </Button>
          <Button variant="danger" size="sm" onClick={run(onDelete)}>
            Remove
          </Button>
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="cursor-pointer mx-auto block text-sm text-ink-400 hover:text-rose-400 transition-colors"
      >
        Remove from library
      </button>
    );
  }

  return null;
}
