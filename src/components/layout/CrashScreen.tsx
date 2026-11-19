'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Shared by the root error page and the last-resort one that stands in when the
 * root layout itself has failed.
 */
export function CrashScreen({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    // The landmark the root layout's "Skip to main content" link goes to.
    <main
      id="main-content"
      className="flex-1 bg-ink-950 flex flex-col items-center justify-center text-center px-6"
    >
      <Gamepad2 className="w-8 h-8 text-ink-600 mb-8" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight text-ink-50 mb-2">
        Something went wrong
      </h1>
      <p className="text-ink-400 mb-8 max-w-md">
        An unexpected error occurred. Try refreshing the page.
      </p>
      <Button onClick={() => retry()} variant="secondary" className="cursor-pointer">
        Try again
      </Button>
    </main>
  );
}
