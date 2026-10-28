'use client';

import { useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col items-center justify-center text-center px-6">
      <Gamepad2 className="w-8 h-8 text-accent-400 mb-8" />
      <h1 className="text-2xl font-bold text-ink-100 mb-2">Something went wrong</h1>
      <p className="text-ink-400 mb-8 max-w-md">
        An unexpected error occurred. Try refreshing the page.
      </p>
      <Button onClick={() => retry()} variant="secondary">
        Try again
      </Button>
    </div>
  );
}
