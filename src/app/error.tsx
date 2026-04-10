'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-center px-6">
      <Gamepad2 className="w-8 h-8 text-violet-400 mb-8" />
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">Something went wrong</h1>
      <p className="text-zinc-400 mb-8 max-w-md">
        An unexpected error occurred. Try refreshing the page.
      </p>
      <Button onClick={reset} variant="secondary">
        Try again
      </Button>
    </div>
  );
}
