import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';
import { AuthMessage } from '@/components/auth/AuthMessage';
import { Panel } from '@/components/ui/Panel';

export const metadata = {
  title: 'Reset password',
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const linkInvalid = !!error || !user;

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center px-4 pt-20">
      <Panel className="w-full max-w-md sm:p-8">
        <h1 className="text-xl font-semibold tracking-tight text-ink-50 mb-6">
          Reset your password
        </h1>
        {linkInvalid ? (
          <div className="space-y-4">
            <AuthMessage
              icon={AlertCircle}
              tone="error"
              title="This reset link is invalid or expired"
            >
              Request a new link from the sign in screen and try again
            </AuthMessage>
            <Link
              href="/"
              // The secondary button, as a link.
              className="flex h-10 w-full items-center justify-center rounded-lg bg-ink-800 text-sm font-medium text-ink-100 transition-colors hover:bg-ink-700"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <ResetPasswordForm />
        )}
      </Panel>
    </main>
  );
}
