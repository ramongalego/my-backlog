'use client';

import { CloudOff } from 'lucide-react';
import { Button } from './Button';
import { EmptyState } from './EmptyState';

/**
 * Shown in place of a page's content when its data couldn't be loaded, so a
 * failed request isn't mistaken for an empty library.
 */
export function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <EmptyState
        icon={CloudOff}
        title={`Couldn't load ${what}`}
        action={
          <Button variant="secondary" className="cursor-pointer" onClick={onRetry}>
            Try again
          </Button>
        }
      >
        Nothing in your library has changed. Check your connection and try again.
      </EmptyState>
    </div>
  );
}
