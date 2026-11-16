'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { DownloadData } from '@/components/profile/DownloadData';
import type { ExportFormat } from '@/lib/account/export';
import type { AccountResult } from '@/lib/client/account';
import type { ApiResult } from '@/lib/client/request';

/**
 * Deletes the account, for good: says what goes, offers a copy of it to
 * download first, and asks for the password before doing it. Once it's done
 * the page leaves for the landing page (the page's part), so this stays
 * saying "Deleting…" until then.
 */
export function DeleteAccountDialog({
  onDelete,
  onDownloadData,
  onClose,
}: {
  onDelete: (password: string) => Promise<AccountResult>;
  /** Left out when there's nothing to copy (no games): the offer isn't made. */
  onDownloadData?: (format: ExportFormat) => Promise<ApiResult>;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // A request on its way. The button is disabled from the next redraw; this
  // stops a second press before then from sending again.
  const submitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setServerError(null);
    if (!password) {
      setError('Enter your password');
      return;
    }
    submitting.current = true;
    setDeleting(true);
    const result = await onDelete(password);
    if (result.ok) return; // The page is on its way to the landing page.
    submitting.current = false;
    setDeleting(false);
    if (result.field) setError(result.error);
    else setServerError(result.error);
  };

  return (
    <Modal isOpen onClose={deleting ? undefined : onClose} title="Delete account" size="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-ink-300">
          This deletes your account and everything in it: your library, diary, queue, favorites and
          profile picture. It can&apos;t be undone.
        </p>
        {onDownloadData && (
          <DownloadData onDownload={onDownloadData}>Want a copy first?</DownloadData>
        )}

        {serverError && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">
            {serverError}
          </div>
        )}

        <Input
          label="Your password, to confirm"
          id="delete-account-password"
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
            setServerError(null);
          }}
          error={error ?? undefined}
          required
          autoComplete="current-password"
          data-autofocus
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={deleting}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            size="sm"
            isLoading={deleting}
            className="cursor-pointer"
          >
            {deleting ? 'Deleting…' : 'Delete account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
