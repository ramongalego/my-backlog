'use client';

import { useEffect } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PAGE_CONTAINER } from '@/components/layout/Page';

/**
 * A signed-in page that crashed. It sits inside the (app) layout, so the
 * header and menus stay and you can go somewhere else.
 */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      className={`${PAGE_CONTAINER} min-h-screen pt-14 sm:pt-16 flex flex-col items-center justify-center text-center`}
    >
      <Gamepad2 className="w-8 h-8 text-ink-600 mb-6" aria-hidden="true" />
      <h1 className="text-2xl font-semibold text-ink-100 mb-2">This page hit a problem</h1>
      <p className="text-ink-400 mb-8 max-w-md">
        Nothing in your library has changed. Try again, or pick another page from the menu.
      </p>
      <Button onClick={() => retry()} variant="secondary" className="cursor-pointer">
        Try again
      </Button>
    </main>
  );
}
