'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { changePasswordSchema, type ChangePasswordFormData } from '@/lib/validations/auth';
import { issuesByField } from '@/lib/validations/common';
import type { AccountResult } from '@/lib/client/account';

type Field = keyof ChangePasswordFormData;

const EMPTY: ChangePasswordFormData = { currentPassword: '', password: '', confirmPassword: '' };

/**
 * Changes the password from the profile: the current one, then the new one
 * twice. Forgotten the current one? A reset link can be emailed from here,
 * as from the sign-in screen. On success it closes and says so; every other
 * device has been signed out.
 */
export function ChangePasswordDialog({
  email,
  onSubmit,
  onSendReset,
  onClose,
}: {
  /** Where a reset link goes. */
  email: string;
  onSubmit: (currentPassword: string, newPassword: string) => Promise<AccountResult>;
  onSendReset: () => Promise<boolean>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ChangePasswordFormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reset, setReset] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  // Requests on their way. Buttons are disabled from the next redraw; these
  // stop a second press before then from sending again.
  const submitting = useRef(false);
  const sendingReset = useRef(false);

  const change = (field: Field) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    // What was said was about what was typed before.
    setErrors((prev) => ({ ...prev, [field]: undefined }));
    setServerError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setServerError(null);

    const parsed = changePasswordSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesByField<Field>(parsed.error.issues));
      return;
    }
    setErrors({});

    submitting.current = true;
    setSaving(true);
    try {
      const result = await onSubmit(parsed.data.currentPassword, parsed.data.password);
      if (result.ok) {
        toast.success('Password changed. Your other devices are signed out.');
        onClose();
        return;
      }
      if (result.field) setErrors({ [result.field]: result.error });
      else setServerError(result.error);
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  const handleSendReset = async () => {
    if (sendingReset.current) return;
    sendingReset.current = true;
    setReset('sending');
    try {
      setReset((await onSendReset()) ? 'sent' : 'failed');
    } finally {
      sendingReset.current = false;
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Change password" size="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {serverError && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">
            {serverError}
          </div>
        )}

        <div>
          <Input
            label="Current password"
            id="current-password"
            type="password"
            value={form.currentPassword}
            onChange={change('currentPassword')}
            error={errors.currentPassword}
            required
            autoComplete="current-password"
            data-autofocus
          />
          {/* Said as it changes, in place of the button that asked for it. */}
          <p className="mt-1.5 text-xs text-ink-400" role="status">
            {reset === 'sent' ? (
              <>Reset link sent to {email}</>
            ) : (
              <>
                {reset === 'failed' && (
                  <span className="text-rose-400">Couldn&apos;t send the link. </span>
                )}
                Forgot it?{' '}
                <button
                  type="button"
                  onClick={handleSendReset}
                  disabled={reset === 'sending'}
                  className="-my-1 cursor-pointer py-1 font-medium text-ink-200 underline underline-offset-2 hover:text-ink-50 disabled:cursor-default disabled:text-ink-500"
                >
                  {reset === 'sending' ? 'Sending…' : 'Email me a reset link'}
                </button>
              </>
            )}
          </p>
        </div>

        <Input
          label="New password"
          id="new-password"
          type="password"
          value={form.password}
          onChange={change('password')}
          error={errors.password}
          required
          autoComplete="new-password"
        />
        <Input
          label="Confirm new password"
          id="confirm-new-password"
          type="password"
          value={form.confirmPassword}
          onChange={change('confirmPassword')}
          error={errors.confirmPassword}
          required
          autoComplete="new-password"
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="cursor-pointer"
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={saving} className="cursor-pointer">
            {saving ? 'Changing…' : 'Change password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
