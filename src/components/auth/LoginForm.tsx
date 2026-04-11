'use client';

import { useState } from 'react';
import { AuthError } from '@supabase/supabase-js';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface LoginFormProps {
  onSuccess?: () => void;
  onSwitchToSignUp?: () => void;
  onSwitchToForgotPassword?: () => void;
}

function mapLoginError(error: AuthError): string {
  // Avoid leaking whether an email is registered — collapse credential errors to one message.
  if (error.code === 'invalid_credentials') {
    return 'Invalid email or password.';
  }
  if (error.code === 'email_not_confirmed') {
    return 'Please confirm your email before signing in. Check your inbox for the confirmation link.';
  }
  return 'Something went wrong. Please try again.';
}

export function LoginForm({
  onSuccess,
  onSwitchToSignUp,
  onSwitchToForgotPassword,
}: LoginFormProps) {
  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof LoginFormData]) {
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

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LoginFormData, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof LoginFormData;
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
      const { error } = await supabase.auth.signInWithPassword({
        email: result.data.email,
        password: result.data.password,
      });

      if (error) {
        setServerError(mapLoginError(error));
        return;
      }

      onSuccess?.();
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {serverError && (
        <div
          className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm"
          role="alert"
        >
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

      <div>
        <Input
          label="Password"
          type="password"
          name="password"
          value={formData.password}
          onChange={handleChange}
          placeholder="Enter your password"
          error={errors.password}
          autoComplete="current-password"
        />
        {onSwitchToForgotPassword && (
          <div className="mt-1.5 text-right">
            <button
              type="button"
              onClick={onSwitchToForgotPassword}
              className="text-sm text-violet-400 hover:text-violet-300 font-medium transition-colors"
            >
              Forgot password?
            </button>
          </div>
        )}
      </div>

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Sign In
      </Button>

      {onSwitchToSignUp && (
        <p className="text-center text-sm text-zinc-400">
          Don&apos;t have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToSignUp}
            className="text-violet-400 hover:text-violet-300 font-medium transition-colors"
          >
            Sign up
          </button>
        </p>
      )}
    </form>
  );
}
