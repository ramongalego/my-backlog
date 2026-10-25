'use client';

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { forgotPasswordSchema, type ForgotPasswordFormData } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface ForgotPasswordFormProps {
  onSwitchToLogin?: () => void;
}

export function ForgotPasswordForm({ onSwitchToLogin }: ForgotPasswordFormProps) {
  const [formData, setFormData] = useState<ForgotPasswordFormData>({ email: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof ForgotPasswordFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
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
      setIsLoading(false);
    }
  };

  if (isSent) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="p-3 rounded-full bg-accent-500/10">
            <MailCheck className="w-8 h-8 text-accent-400" aria-hidden="true" />
          </div>
          <p className="text-ink-100 font-medium">Check your email</p>
          <p className="text-sm text-ink-400">
            If an account exists for {formData.email}, we&apos;ve sent a link to reset your
            password.
          </p>
        </div>
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

      {serverError && (
        <div className="p-3 bg-rose-500/10 rounded-lg text-rose-300 text-sm" role="alert">
          {serverError}
        </div>
      )}

      <Input
        label="Email"
        type="email"
        name="email"
        value={formData.email}
        onChange={handleChange}
        placeholder="you@example.com"
        error={errors.email}
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
            className="text-accent-400 hover:text-accent-300 font-medium transition-colors"
          >
            Sign in
          </button>
        </p>
      )}
    </form>
  );
}
