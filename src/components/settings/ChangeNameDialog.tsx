'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DialogActions } from '@/components/ui/DialogActions';
import { Modal } from '@/components/ui/Modal';
import { MAX_NAME_LENGTH } from '@/lib/validations/profile';
import type { ApiResult } from '@/lib/client/request';

/**
 * The name the profile goes by. Left empty, it goes back to the account's
 * (`accountName`: the Steam name, or the email before its @).
 */
export function ChangeNameDialog({
  chosen,
  accountName,
  onSubmit,
  onClose,
}: {
  /** The name the player chose, or null when it's the account's. */
  chosen: string | null;
  accountName: string;
  onSubmit: (name: string | null) => Promise<ApiResult<{ name: string | null }>>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState(chosen ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A request on its way. The button is disabled from the next redraw; this
  // stops a second press before then from sending again.
  const submitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    const next = typed.replace(/\s+/g, ' ').trim() || null;
    // Nothing to save.
    if (next === chosen) return onClose();
    if (next && next.length > MAX_NAME_LENGTH) {
      setError(`Keep it to ${MAX_NAME_LENGTH} characters`);
      return;
    }
    setError(null);

    submitting.current = true;
    setSaving(true);
    try {
      const result = await onSubmit(next);
      // Whatever went wrong is about the name: said under its field.
      if (!result.ok) return setError(result.error);
      toast.success(
        result.name
          ? `Your display name is now ${result.name}`
          : `Your display name is ${accountName} again`,
      );
      onClose();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Change display name" size="md" startOnTitle>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Display name"
          id="display-name"
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            // What was said was about what was typed before.
            setError(null);
          }}
          error={error ?? undefined}
          hint={`Leave it empty to use ${accountName}`}
          placeholder={accountName}
          maxLength={MAX_NAME_LENGTH + 10}
          autoComplete="nickname"
        />

        <DialogActions>
          <Button type="button" variant="secondary" onClick={onClose} className="cursor-pointer">
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} className="cursor-pointer">
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </form>
    </Modal>
  );
}
