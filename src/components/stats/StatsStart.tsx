'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Figure, Lead } from '@/components/ui/Lead';
import { SteamIcon } from '@/components/ui/SteamIcon';

interface StartProps {
  isSteamConnected: boolean;
  onAddGame: () => void;
  onConnectSteam: () => void;
}

/** The two ways to give Stats something to show: add games, or bring in Steam. */
export function StatsStartButtons({ isSteamConnected, onAddGame, onConnectSteam }: StartProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="lg" className="cursor-pointer" onClick={onAddGame}>
        <Plus className="w-5 h-5" aria-hidden="true" />
        <span>Add a game</span>
      </Button>
      {!isSteamConnected && (
        <Button variant="secondary" size="lg" className="cursor-pointer" onClick={onConnectSteam}>
          <SteamIcon className="w-5 h-5" />
          <span>Connect Steam</span>
        </Button>
      )}
    </div>
  );
}

const plural = (n: number, word: string) =>
  `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

/**
 * Stats before there's anything to report: nothing finished, dropped or
 * played yet, as on a new account. Says what you have so far, what the page
 * will show once you play, and how to get there, instead of a page of empty
 * sections.
 */
export function StatsStart({
  backlog,
  storyHours,
  ...buttons
}: StartProps & { backlog: number; storyHours: number }) {
  return (
    <section aria-label="Getting started" className="max-w-2xl">
      <Lead>
        You have <Figure>{plural(backlog, 'game')}</Figure> in your backlog
        {storyHours > 0 && (
          <>
            , about <Figure>{plural(storyHours, 'hour')}</Figure> of story
          </>
        )}
        . Your stats fill in as you play.
      </Lead>
      <p className="mt-3 text-ink-400 leading-relaxed">
        {buttons.isSteamConnected
          ? 'Once you’ve finished a few, this page shows'
          : 'Once you’ve finished a few, or brought in your hours from Steam, this page shows'}{' '}
        where your time went, your favourite games, what you tend to finish and how long your
        backlog would take to clear.
      </p>
      <div className="mt-6">
        <StatsStartButtons {...buttons} />
      </div>
    </section>
  );
}
