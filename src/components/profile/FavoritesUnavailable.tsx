'use client';

import { Button } from '@/components/ui/Button';
import { ProfileSection } from './ProfileSection';

/**
 * In place of the favorites row while the picks aren't known: still loading,
 * or they couldn't be loaded. Never the row itself, drawn empty: picking into
 * it would save over the favorites that didn't load.
 */
export function FavoritesUnavailable({
  failed,
  onRetry,
}: {
  /** They couldn't be loaded, rather than being on their way. */
  failed: boolean;
  onRetry: () => void;
}) {
  return (
    <ProfileSection id="profile-favorites" title="Favorite games">
      {failed ? (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm text-ink-400">Couldn&apos;t load your favorites</p>
          <Button variant="secondary" size="sm" onClick={onRetry} className="cursor-pointer">
            Try again
          </Button>
        </div>
      ) : (
        <p role="status" className="text-sm text-ink-500">
          Loading your favorites…
        </p>
      )}
    </ProfileSection>
  );
}
