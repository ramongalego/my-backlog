'use client';

import { useRef, useState } from 'react';
import { MailCheck } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { AuthMessage } from '@/components/auth/AuthMessage';

interface ForgotPasswordFormProps {
  onSwitchToLogin?: () => void;
}

export function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const [formData, setFormData] = useState<ForgotPasswordFormData>({ email: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ForgotPasswordFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // A submit on its way. The button is disabled from the next redraw; this
  // stops a second press before then from sending the form again.
  const submitting = useRef(false);
  const [isSent, setIsSent] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ForgotPasswordFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) {
      setServerError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setErrors({});
    setServerError(null);

    const result = forgotPasswordSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ForgotPasswordFormData, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ForgotPasswordFormData;
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    submitting.current = true;
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(result.data.email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      });

      if (error) {
        setServerError('Something went wrong. Please try again.');
        return;
      }

      setIsSent(true);
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="space-y-4">
        <AuthMessage icon={MailCheck} title="Check your email">
          If an account exists for {formData.email}, we&apos;ve sent a link to reset your password.
        </AuthMessage>
        {onSwitchToLogin && (
          <Button variant="secondary" className="w-full" onClick={onSwitchToLogin}>
            Back to sign in
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <p className="text-sm text-ink-400">
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>

      {serverError && <FormError>{serverError}</FormError>}

      <Input
        label="Email"
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="you@example.com"
        error={errors.email}
        required
        autoComplete="email"
      />

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Send reset link
      </Button>

      {onSwitchToLogin && (
        <p className="text-center text-sm text-ink-400">
          Remembered your password?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="py-1 -my-1 text-accent-400 hover:text-accent-300 font-medium transition-colors"
          >
            Sign in
          </button>
        </p>
      )}
    </form>
  );
}
