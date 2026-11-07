'use client';

// Below this many backlog games, the picker band says picks get better with more.
const SMALL_BACKLOG = 10;

const INLINE_LINK =
  'cursor-pointer font-medium text-ink-200 underline decoration-ink-600 underline-offset-4 hover:text-ink-50 transition-colors';

/**
 * The line under Pick My Game: with a small backlog, that picks get better
 * with more games (and how to get there); otherwise, connecting Steam until
 * it's connected. Nothing once neither applies.
 */
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
            , or{' '}
            <button onClick={onConnectSteam} className={INLINE_LINK}>
              connect Steam
            </button>{' '}
            to bring in your whole library
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
      <button onClick={onConnectSteam} className={INLINE_LINK}>
        Connect Steam
      </button>{' '}
      to bring in your library.
    </p>
  );
}
