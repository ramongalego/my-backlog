'use client';

import { useState } from 'react';
import { MailCheck } from 'lucide-react';
import { signUpSchema, type SignUpFormData } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AuthMessage } from '@/components/auth/AuthMessage';

interface SignUpFormProps {
  onSwitchToLogin?: () => void;
}

export function SignUpForm({ onSwitchToLogin }: SignUpFormProps) {
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [formData, setFormData] = useState<SignUpFormData>({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof SignUpFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [accountExists, setAccountExists] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof SignUpFormData]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
    if (serverError) {
      setServerError(null);
    }
    if (accountExists) setAccountExists(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setServerError(null);
    setAccountExists(false);

    const result = signUpSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof SignUpFormData, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof SignUpFormData;
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
      const { data, error } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/home`,
        },
      });

      if (error) {
        setServerError(error.message);
        return;
      }

      if (data.session) {
        window.location.reload();
        return;
      }

      // For an email that already has an account, Supabase sends nothing and
      // answers with a stand-in user that has no sign-in methods.
      if (data.user && data.user.identities?.length === 0) {
        setAccountExists(true);
        return;
      }

      setSubmittedEmail(result.data.email);
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="space-y-4">
        <AuthMessage icon={MailCheck} title="Check your email">
          We sent a confirmation link to {submittedEmail}. Click the link to activate your account.
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
      {serverError && (
        <div className="p-3 bg-rose-500/10 rounded-lg text-rose-300 text-sm" role="alert">
          {serverError}
        </div>
      )}
      {accountExists && (
        <div className="p-3 bg-rose-500/10 rounded-lg text-rose-300 text-sm" role="alert">
          That email already has an account.
          {onSwitchToLogin && (
            <>
              {' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="font-medium text-rose-200 underline underline-offset-2 hover:text-rose-100 cursor-pointer"
              >
                Sign in instead
              </button>
            </>
          )}
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

      <Input
        label="Password"
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Create a password"
        error={errors.password}
        autoComplete="new-password"
      />

      <Input
        label="Confirm Password"
        type="password"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
        placeholder="Confirm your password"
        error={errors.confirmPassword}
        autoComplete="new-password"
      />

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Create Account
      </Button>

      {onSwitchToLogin && (
        <p className="text-center text-sm text-ink-400">
          Already have an account?{' '}
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
