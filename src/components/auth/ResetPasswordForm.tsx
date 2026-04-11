'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export function ResetPasswordForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ResetPasswordFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name as keyof ResetPasswordFormData]) {
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

    const result = resetPasswordSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ResetPasswordFormData, string>> = {};
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof ResetPasswordFormData;
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
      const { error } = await supabase.auth.updateUser({ password: result.data.password });

      if (error) {
        setServerError(error.message);
        return;
      }

      setIsDone(true);
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isDone) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center text-center gap-3 py-4">
          <div className="p-3 rounded-full bg-emerald-500/10">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" aria-hidden="true" />
          </div>
          <p className="text-zinc-100 font-medium">Password updated</p>
          <p className="text-sm text-zinc-400">You can now use your new password to sign in.</p>
        </div>
        <Button className="w-full" onClick={() => router.push('/home')}>
          Continue
        </Button>
      </div>
    );
  }

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
        label="New password"
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Enter a new password"
        error={errors.password}
        autoComplete="new-password"
      />

      <Input
        label="Confirm new password"
        type="password"
        name="confirmPassword"
        value={formData.confirmPassword}
        onChange={handleChange}
        placeholder="Confirm your new password"
        error={errors.confirmPassword}
        autoComplete="new-password"
      />

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Update password
      </Button>
    </form>
  );
}
