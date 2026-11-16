'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { changeEmailBodySchema } from '@/lib/validations/auth';
import { issuesByField } from '@/lib/validations/common';
import type { EmailChangeResult } from '@/lib/client/account';

type Field = 'email' | 'password';

/**
 * Changes the email from the profile, with the password to confirm it's them:
 * a new email is a way into the account. Supabase emails links to confirm it,
 * one to each address, and nothing changes until they're opened; the profile
 * shows the new address as waiting until then.
 */
export function ChangeEmailDialog({
  email,
  onSubmit,
  onClose,
}: {
  /** The email now. */
  email: string;
  onSubmit: (email: string, password: string) => Promise<EmailChangeResult>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A request on its way. The button is disabled from the next redraw; this
  // stops a second press before then from sending again.
  const submitting = useRef(false);

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

    const parsed = changeEmailBodySchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesByField<Field>(parsed.error.issues));
      return;
    }
    const next = parsed.data.email;
    if (next.toLowerCase() === email.toLowerCase()) {
      setErrors({ email: "That's already your email" });
      return;
    }
    setErrors({});

    submitting.current = true;
    setSaving(true);
    try {
      const result = await onSubmit(next, parsed.data.password);
      if (!result.ok) {
        // Only this form's fields: anything else is said above it.
        if (result.field === 'email' || result.field === 'password') {
          setErrors({ [result.field]: result.error });
        } else setServerError(result.error);
        return;
      }
      if (result.pendingEmail) {
        toast.success('Check your email', {
          description: `We sent links to ${email} and ${result.pendingEmail}. Your email changes once you've opened both.`,
        });
      } else {
        toast.success(`Your email is now ${result.email ?? next}`);
      }
      onClose();
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Change email" size="md">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <p className="text-sm text-ink-400">
          {/* An address has no spaces to wrap at: it breaks where it must. */}
          It&apos;s <span className="text-ink-200 [overflow-wrap:anywhere]">{email}</span> now.
          We&apos;ll email links to confirm the change, and it&apos;s made once they&apos;re opened.
        </p>

        {serverError && (
          <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-300" role="alert">
            {serverError}
          </div>
        )}

        <Input
          label="New email"
          id="new-email"
          type="email"
          value={form.email}
          onChange={change('email')}
          error={errors.email}
          required
          autoComplete="email"
          data-autofocus
        />
        <Input
          label="Your password, to confirm"
          id="change-email-password"
          type="password"
          value={form.password}
          onChange={change('password')}
          error={errors.password}
          required
          autoComplete="current-password"
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
            {saving ? 'Sending…' : 'Send confirmation'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
