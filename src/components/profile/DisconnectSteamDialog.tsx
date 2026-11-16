'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

type Result = { ok: true } | { ok: false; error: string };

/**
 * Unlinks Steam, saying first, plainly, what's lost for good: the Steam games
 * and what was logged on them. Games on other consoles (added by hand, or
 * Steam games moved to one) stay. Once it's done the page reloads (the page's
 * part), so this stays saying "Disconnecting…" until then.
 */
export function DisconnectSteamDialog({
  steamGames,
  onDisconnect,
  onClose,
}: {
  /** How many games come out with it. */
  steamGames: number;
  onDisconnect: () => Promise<Result>;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  // A request on its way: the button is disabled from the next redraw.
  const submitting = useRef(false);

  const disconnect = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setWorking(true);
    setError(null);
    const result = await onDisconnect();
    if (result.ok) return; // The page is reloading.
    submitting.current = false;
    setWorking(false);
    setError(result.error);
  };

  // What's lost, said as permanent: connecting again brings the games back,
  // but not what was logged on them.
  const lost =
    steamGames === 1
      ? 'Your Steam game and its rating, notes and finish date will be permanently removed.'
      : `Your ${steamGames} Steam games and their ratings, notes and finish dates will be permanently removed.`;

  return (
    <Modal isOpen onClose={working ? undefined : onClose} title="Disconnect Steam" size="md">
      <div className="space-y-4">
        <p className="text-sm text-ink-300">
          {steamGames > 0 && <>{lost} </>}
          Games on other consoles stay.
        </p>
        <p className="text-sm text-ink-400">
          Connecting Steam again brings the games back, but not their ratings, notes or finish
          dates.
        </p>

        {error && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={working}
            // Where the dialog starts: the safe way out, not the action.
            data-autofocus
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={disconnect}
            isLoading={working}
            className="cursor-pointer"
          >
            {working ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
