'use client';

import { Dices, ListOrdered, Plus } from 'lucide-react';
import { PickIcon } from '@/components/suggest/PickIcon';
import { Button } from '@/components/ui/Button';
import { COVER_ASPECT } from '@/components/games/CoverArt';
import { CoverShelf } from '@/components/suggest/CoverShelf';

// Enough for a wall of four rows without a game repeating.
const WALL_COVERS = 16;

/**
 * The art for the band's wall: a game from each of Home's rows in turn, so it
 * shows the whole backlog rather than one kind of game. Not shuffled, so the
 * server and the browser draw the same wall.
 */
export function wallCovers(rows: { header_image: string | null }[][]): string[] {
  const covers = new Set<string>();
  for (let i = 0; covers.size < WALL_COVERS && rows.some((row) => i < row.length); i++) {
    for (const row of rows) {
      const art = row[i]?.header_image;
      if (art) covers.add(art);
    }
  }
  return [...covers].slice(0, WALL_COVERS);
}

interface PickNextProps {
  covers: string[];
  backlogCount: number;
  onPick: () => void;
  onRandom: () => void;
  /**
   * Every backlog game is already queued, so there's nothing to pick from
   * (both picks leave queued games out): point at the queue and at adding
   * more instead of offering picks that would come back empty.
   */
  allQueued?: { onOpenQueue: () => void; onAddGame: () => void };
  /** Shown under the buttons, e.g. the nudge to connect Steam. */
  children?: React.ReactNode;
}

/**
 * Home's band while nothing is playing, laid out like the playing band: your
 * backlog as a tilted wall of art where the game will be, and the question
 * beside it. Random shuffles through that same frame (`RandomRoll`), and the
 * game it lands on takes its place.
 */
export function PickNext({
  covers,
  backlogCount,
  onPick,
  onRandom,
  allQueued,
  children,
}: PickNextProps) {
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] lg:grid-cols-[minmax(0,32rem)_1fr] md:gap-10 lg:gap-12 md:items-center">
      {/* The art opens Pick My Game too; the button beside it is the one to
          reach by keyboard and screen reader. */}
      <button
        type="button"
        onClick={allQueued ? allQueued.onOpenQueue : onPick}
        tabIndex={-1}
        aria-hidden="true"
        className={`group relative ${COVER_ASPECT} overflow-hidden rounded-xl bg-ink-800 cursor-pointer`}
      >
        <CoverShelf
          covers={covers}
          rows={4}
          className="transition-[scale,filter] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] brightness-90 group-hover:brightness-105 group-hover:scale-[1.03] motion-reduce:transition-none"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent" />
        <p className="absolute bottom-4 left-4 sm:left-5 text-left">
          <span className="block text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums text-ink-50">
            {backlogCount.toLocaleString('en-US')}
          </span>
          <span className="block text-sm font-medium text-ink-200">
            {backlogCount === 1 ? 'game' : 'games'} waiting in your backlog
          </span>
        </p>
      </button>

      <div className="min-w-0 max-w-xl">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-ink-50">
          What are you playing next?
        </h1>
        {allQueued ? (
          <>
            <p className="mt-3 text-ink-300 leading-relaxed">
              Every game in your backlog is already in your queue. Start one from there, or add more
              games for MyBacklog to pick from.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button size="lg" className="cursor-pointer" onClick={allQueued.onOpenQueue}>
                <ListOrdered className="w-5 h-5" aria-hidden="true" />
                <span>Go to your queue</span>
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="cursor-pointer"
                onClick={allQueued.onAddGame}
              >
                <Plus className="w-5 h-5" aria-hidden="true" />
                <span>Add a game</span>
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 text-ink-300 leading-relaxed">
              Say how you want to feel, how much energy you have and how long you can play, and
              MyBacklog picks one from your backlog for tonight. Or leave it to chance.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Button size="lg" className="group cursor-pointer" onClick={onPick}>
                <PickIcon className="w-5 h-5" />
                <span>Pick My Game</span>
              </Button>
              <Button
                onClick={onRandom}
                variant="secondary"
                size="lg"
                className="cursor-pointer"
                title="Pick a random game"
              >
                <Dices className="w-5 h-5" aria-hidden="true" />
                <span>Random</span>
              </Button>
            </div>
          </>
        )}
        {children}
      </div>
    </div>
  );
}
