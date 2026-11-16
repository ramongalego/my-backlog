'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { DialogActions } from '@/components/ui/DialogActions';
import { Modal } from '@/components/ui/Modal';
import { DownloadData } from '@/components/profile/DownloadData';
import type { ExportFormat } from '@/lib/account/export';
import type { ApiResult } from '@/lib/client/request';

type Result = ApiResult;

/**
 * Unlinks Steam, saying first, plainly, what's lost for good: the Steam games
 * and what was logged on them. Games on other consoles (added by hand, or
 * Steam games moved to one) stay. A copy of it all can be downloaded first.
 * Once it's done the page reloads (the page's part), so this stays saying
 * "Disconnecting…" until then.
 */
export function DisconnectSteamDialog({
  steamGames,
  onDisconnect,
  onDownloadData,
  onClose,
}: {
  /** How many games come out with it. */
  steamGames: number;
  onDisconnect: () => Promise<Result>;
  /** Left out when there's nothing to copy. */
  onDownloadData?: (format: ExportFormat) => Promise<ApiResult>;
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
        {steamGames > 0 && onDownloadData && (
          <DownloadData onDownload={onDownloadData}>Want a copy first?</DownloadData>
        )}

        {error && <FormError>{error}</FormError>}

        <DialogActions>
          <Button
            type="button"
            variant="secondary"
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
            onClick={disconnect}
            isLoading={working}
            className="cursor-pointer"
          >
            {working ? 'Disconnecting…' : 'Disconnect'}
          </Button>
        </DialogActions>
      </div>
    </Modal>
  );
}
