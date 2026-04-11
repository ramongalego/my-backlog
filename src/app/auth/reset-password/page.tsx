import Link from 'next/link';
import { AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

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
      <div className="w-full max-w-md bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-800 p-6 sm:p-8">
        <h1 className="text-xl font-semibold text-zinc-100 mb-6">Reset your password</h1>
        {linkInvalid ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center text-center gap-3 py-4">
              <div className="p-3 rounded-full bg-red-500/10">
                <AlertCircle className="w-8 h-8 text-red-400" aria-hidden="true" />
              </div>
              <p className="text-zinc-100 font-medium">This reset link is invalid or expired</p>
              <p className="text-sm text-zinc-400">
                Request a new link from the sign in screen and try again.
              </p>
            </div>
            <Link
              href="/"
              className="block w-full text-center px-4 py-2 rounded-lg bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700 transition-colors text-sm font-medium"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <ResetPasswordForm />
        )}
      </div>
    </main>
  );
}
