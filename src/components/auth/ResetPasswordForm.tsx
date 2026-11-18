'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { resetPasswordSchema, type ResetPasswordFormData } from '@/lib/validations/auth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { FormError } from '@/components/ui/FormError';
import { Input } from '@/components/ui/Input';
import { AuthMessage } from '@/components/auth/AuthMessage';

export function ResetPasswordForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<ResetPasswordFormData>({
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ResetPasswordFormData, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // `disabled` only applies from the next redraw; this stops a second submit before then.
  const submitting = useRef(false);
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
    if (submitting.current) return;
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

    submitting.current = true;
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
      submitting.current = false;
      setIsLoading(false);
    }
  };

  if (isDone) {
    return (
      <div className="space-y-4">
        <AuthMessage icon={CheckCircle2} tone="success" title="Password updated">
          You can now use your new password to sign in
        </AuthMessage>
        <Button className="w-full" onClick={() => router.push('/home')}>
          Continue
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {serverError && <FormError>{serverError}</FormError>}

      <Input
        label="New password"
        type="password"
        name="password"
        value={formData.password}
        onChange={handleChange}
        placeholder="Enter a new password"
        error={errors.password}
        required
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
        required
        autoComplete="new-password"
      />

      <Button type="submit" className="w-full" isLoading={isLoading}>
        Update password
      </Button>
    </form>
  );
}
