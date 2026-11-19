'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { DialogActions } from '@/components/ui/DialogActions';
import { Modal } from '@/components/ui/Modal';
import { USERNAME_HINT, cleanUsername, usernameProblem } from '@/lib/account/username';
import type { ApiResult } from '@/lib/client/request';

export function ChangeUsernameDialog({
  username,
  onSubmit,
  onClose,
}: {
  /** The current username. */
  username: string;
  onSubmit: (username: string) => Promise<ApiResult<{ username: string }, 'username'>>;
  onClose: () => void;
}) {
  const [typed, setTyped] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A request on its way. The button is disabled from the next redraw; this
  // stops a second press before then from sending again.
  const submitting = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setServerError(null);

    const next = cleanUsername(typed);
    const problem =
      usernameProblem(next) ?? (next === username ? "That's already your username" : null);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);

    submitting.current = true;
    setSaving(true);
    try {
      const result = await onSubmit(next);
      if (!result.ok) {
        // About the username itself (taken, not allowed): said under the field.
        if (result.field === 'username') setError(result.error);
        else setServerError(result.error);
        return;
      }
      toast.success(`Your username is now ${result.username}`);
      onClose();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Change username" size="md" startOnTitle>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError && <FormError>{serverError}</FormError>}

        <Input
          label="New username"
          id="new-username"
          value={typed}
          // Capitals are the same username: shown as it will be saved.
          onChange={(e) => {
            setTyped(e.target.value.toLowerCase());
            // What was said was about what was typed before.
            setError(null);
            setServerError(null);
          }}
          error={error ?? undefined}
          hint={USERNAME_HINT}
          required
          maxLength={40}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
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
