import { MIN_GAMES_TO_PICK } from '@/lib/data/loaders';

/**
 * How close a new backlog is to Pick My Game: one segment per game it needs,
 * filled in ember like the library import's bar in the same band. Adding a
 * game fills the next segment from the left, so the step forward shows.
 */
export function BacklogProgress({
  count,
  historyCount,
}: {
  /** Backlog games so far. */
  count: number;
  /** Finished and dropped games, which don't count toward picking. */
  historyCount: number;
}) {
  const filled = Math.min(count, MIN_GAMES_TO_PICK);
  return (
    <div className="mt-5">
      <div
        className="flex max-w-xs gap-1.5"
        role="progressbar"
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={MIN_GAMES_TO_PICK}
        aria-label="Games to pick from"
      >
        {Array.from({ length: MIN_GAMES_TO_PICK }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-800">
            <span
              className={`block h-full origin-left rounded-full bg-accent-500 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${i < filled ? 'scale-x-100' : 'scale-x-0'}`}
            />
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-400">
        {filled} of {MIN_GAMES_TO_PICK} games
        {/* A game added as finished or dropped goes to the Diary or the Games
            list, not here: say so, or it looks like adding it didn't work. */}
        {historyCount > 0 && <> · finished and dropped don&apos;t count</>}
      </p>
    </div>
  );
}
