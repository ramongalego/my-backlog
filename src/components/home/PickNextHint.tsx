'use client';

import { Loader2 } from 'lucide-react';
import { useConnectSteam } from '@/hooks/useConnectSteam';

// Below this many backlog games, the picker band says picks get better with more.
const SMALL_BACKLOG = 10;

const INLINE_LINK =
  'cursor-pointer font-medium text-ink-200 underline decoration-ink-600 underline-offset-4 hover:text-ink-50 transition-colors';

/** Once pressed, a spinner follows the words until Steam's sign-in page takes over. */
function ConnectSteamLink({ onClick, children }: { onClick: () => void; children: string }) {
  const { connecting } = useConnectSteam();
  return (
    <button
      type="button"
      onClick={onClick}
      // Not `disabled`: it has the focus while Steam's page is on its way.
      aria-disabled={connecting || undefined}
      aria-busy={connecting || undefined}
      className={`${INLINE_LINK} aria-disabled:cursor-default`}
    >
      {children}
      {connecting && (
        <Loader2
          className="ml-1 inline h-3.5 w-3.5 animate-spin align-[-0.15em] motion-reduce:animate-none"
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function PickNextHint({
  backlogCount,
  isSteamConnected,
  onAddGame,
  onConnectSteam,
}: {
  backlogCount: number;
  isSteamConnected: boolean;
  onAddGame: () => void;
  onConnectSteam: () => void;
}) {
  // Three games is enough to pick between, not enough to pick well.
  if (backlogCount < SMALL_BACKLOG) {
    return (
      <p className="mt-4 text-sm text-ink-400">
        Picks get better the more games you have.{' '}
        <button onClick={onAddGame} className={INLINE_LINK}>
          Add a few more
        </button>
        {!isSteamConnected && (
          <>
            , or <ConnectSteamLink onClick={onConnectSteam}>connect Steam</ConnectSteamLink> to
            bring in your whole library
          </>
        )}
        .
      </p>
    );
  }
  if (isSteamConnected) return null;
  return (
    <p className="mt-4 text-sm text-ink-400">
      Games on Steam too?{' '}
      <ConnectSteamLink onClick={onConnectSteam}>Connect Steam</ConnectSteamLink> to bring in your
      library.
    </p>
  );
}
