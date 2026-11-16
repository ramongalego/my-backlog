'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { DialogActions } from '@/components/ui/DialogActions';
import { Modal } from '@/components/ui/Modal';
import { DownloadData } from '@/components/profile/DownloadData';
import type { ExportFormat } from '@/lib/account/export';
import { DELETE_CONFIRM_ERROR, DELETE_CONFIRM_WORD, confirmsDelete } from '@/lib/account/sign-in';
import type { AccountResult, DeleteProof } from '@/lib/client/account';
import type { ApiResult } from '@/lib/client/request';

/**
 * Deletes the account, for good: says what goes, offers a copy of it to
 * download first, and asks for the password before doing it. An account
 * with no password (made with Google or Discord) types the word "delete"
 * instead, so it still can't be done by a slip. Once it's done
 * the page leaves for the landing page (the page's part), so this stays
 * saying "Deleting…" until then.
 */
export function DeleteAccountDialog({
  hasPassword,
  onDelete,
  onDownloadData,
  onClose,
}: {
  /** Whether there's a password to ask for. */
  hasPassword: boolean;
  onDelete: (proof: DeleteProof) => Promise<AccountResult>;
  /** Left out when there's nothing to copy (no games): the offer isn't made. */
  onDownloadData?: (format: ExportFormat) => Promise<ApiResult>;
  onClose: () => void;
}) {
  // The password, or the word that stands in for one.
  const [typed, setTyped] = useState('');
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
    if (hasPassword ? !typed : !confirmsDelete(typed)) {
      setError(hasPassword ? 'Enter your password' : DELETE_CONFIRM_ERROR);
      return;
    }
    submitting.current = true;
    setDeleting(true);
    const result = await onDelete(hasPassword ? { password: typed } : { confirm: typed });
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

        {serverError && <FormError>{serverError}</FormError>}

        <Input
          label={
            hasPassword ? 'Your password, to confirm' : `Type "${DELETE_CONFIRM_WORD}" to confirm`
          }
          id="delete-account-password"
          // The word is typed as it is: not hidden, capitalized or corrected.
          {...(hasPassword
            ? { type: 'password', autoComplete: 'current-password' }
            : { type: 'text', autoComplete: 'off', autoCapitalize: 'none', spellCheck: false })}
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setError(null);
            setServerError(null);
          }}
          error={error ?? undefined}
          required
        />

        <DialogActions>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={deleting}
            // Where the dialog starts: the safe way out, not the field. On a
            // phone a focused field opens the keyboard over what's being lost.
            data-autofocus
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={deleting} className="cursor-pointer">
            {deleting ? 'Deleting…' : 'Delete account'}
          </Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
