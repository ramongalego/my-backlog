'use client';

import { Gamepad2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { COVER_ASPECT } from '@/components/games/CoverArt';
import { GameArt } from '@/components/games/GameArt';
import { SteamIcon } from '@/components/ui/SteamIcon';
import { MIN_GAMES_TO_PICK } from '@/lib/data/loaders';

interface BuildBacklogProps {
  /** Art of the backlog games added so far, newest first. */
  covers: string[];
  /** Backlog games so far. */
  count: number;
  /** Finished and dropped games, which don't count toward picking. */
  historyCount: number;
  /** A Steam library that came back empty says so, rather than the usual line. */
  steamEmpty: boolean;
  isSteamConnected: boolean;
  onAddGame: () => void;
  onConnectSteam: () => void;
}

/**
 * One of the three places a new backlog fills before Pick My Game opens:
 * a game's art once one is added (or a plain tile when Home has no art for
 * it), otherwise an outline that opens Add game.
 */
function Slot({
  filled,
  src,
  onAdd,
  className = '',
}: {
  filled: boolean;
  src?: string;
  onAdd: () => void;
  className?: string;
}) {
  if (filled) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl bg-ink-800 after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:ring-1 after:ring-inset after:ring-white/8 ${className}`}
      >
        {src ? (
          // A new game's art settles into its place.
          <div className="absolute inset-0 animate-overlay-in">
            <GameArt src={src} alt="" sizes="(max-width: 768px) 66vw, 340px" />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Gamepad2 className="w-7 h-7 text-ink-500" aria-hidden="true" />
          </div>
        )}
      </div>
    );
  }
  return (
    // The Add a game button beside it is the one to reach by keyboard.
    <button
      type="button"
      onClick={onAdd}
      tabIndex={-1}
      aria-hidden="true"
      className={`group flex items-center justify-center rounded-xl border border-dashed border-ink-700 hover:border-ink-500 hover:bg-ink-800/40 transition-colors cursor-pointer ${className}`}
    >
      <Plus className="w-6 h-6 text-ink-500 group-hover:text-ink-300 transition-colors" />
    </button>
  );
}

/**
 * Home's band for a new backlog, laid out like the others: where the game's
 * art goes, three slots (the games Pick My Game needs), one large and two
 * small, filling with each game's art as it's added. Beside them, how to add
 * them. The slots are the progress, so there's no separate bar.
 */
export function BuildBacklog({
  covers,
  count,
  historyCount,
  steamEmpty,
  isSteamConnected,
  onAddGame,
  onConnectSteam,
}: BuildBacklogProps) {
  const filled = Math.min(count, MIN_GAMES_TO_PICK);
  const slot = (i: number) => ({
    filled: i < filled,
    // Oldest first, so the first game added keeps the large slot.
    src: i < filled ? covers.slice(0, filled).reverse()[i] : undefined,
    onAdd: onAddGame,
  });

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] lg:grid-cols-[minmax(0,32rem)_1fr] md:gap-10 lg:gap-12 md:items-center">
      <div
        className="grid grid-cols-[2fr_1fr] grid-rows-2 gap-2"
        role="progressbar"
        aria-valuenow={filled}
        aria-valuemin={0}
        aria-valuemax={MIN_GAMES_TO_PICK}
        aria-label="Games to pick from"
      >
        <Slot {...slot(0)} className={`row-span-2 ${COVER_ASPECT}`} />
        <Slot {...slot(1)} />
        <Slot {...slot(2)} />
      </div>

      <div className="min-w-0 max-w-xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink-50">
          Build your backlog
        </h1>
        <p className="mt-3 text-ink-300 leading-relaxed">
          {steamEmpty
            ? "Your Steam library came back empty. If your Steam profile's game details are private, make them public and refresh from your account menu, or add games by hand."
            : `Add the games you own and haven't played yet, on any console. Once you have ${MIN_GAMES_TO_PICK}, MyBacklog can pick what to play next.`}
        </p>
        <p className="mt-2 text-sm text-ink-400">
          {filled} of {MIN_GAMES_TO_PICK} games
          {/* A game added as finished or dropped goes to the Diary or the Games
              list, not here: say so, or it looks like adding it didn't work. */}
          {historyCount > 0 && <> · finished and dropped don&apos;t count</>}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Button size="lg" className="cursor-pointer" onClick={onAddGame}>
            <Plus className="w-5 h-5" aria-hidden="true" />
            <span>Add a game</span>
          </Button>
          {!isSteamConnected && (
            <Button
              variant="secondary"
              size="lg"
              className="cursor-pointer"
              onClick={onConnectSteam}
            >
              <SteamIcon className="w-5 h-5" />
              <span>Connect Steam</span>
            </Button>
          )}
        </div>
        {!isSteamConnected && (
          <p className="mt-4 text-sm text-ink-500">
            Connecting Steam imports your whole library with your hours played. It&apos;s optional,
            and you can do it later from your account menu.
          </p>
        )}
      </div>
    </div>
  );
}
