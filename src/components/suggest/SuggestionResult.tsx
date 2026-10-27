'use client';

import { Dices, Gamepad2, RotateCcw, Sparkles, ExternalLink } from 'lucide-react';
import { GameRating, Playtime, TimeToBeat } from '@/components/games/GameCardInfo';
import { Button } from '@/components/ui/Button';
import { steamStoreUrl } from '@/lib/games/store-link';
import { GameArt } from '@/components/games/GameArt';
import type { SuggestionResult as SuggestionResultType } from '@/lib/suggest/types';

interface SuggestionResultProps {
  suggestion: SuggestionResultType;
  onPick: () => void;
  onReroll: () => void;
  cooldownRemaining: number;
  isLoading: boolean;
  mode?: 'play' | 'queue';
  /** Picked at random, not for your answers: no reasoning, and Roll again. */
  random?: boolean;
}

export function SuggestionResult({
  suggestion,
  onPick,
  onReroll,
  cooldownRemaining,
  isLoading,
  mode = 'play',
  random = false,
}: SuggestionResultProps) {
  const { game, reasoning } = suggestion;
  const isOnCooldown = cooldownRemaining > 0;
  const storeUrl = steamStoreUrl(game.app_id);

  return (
    <>
      {/* Hero — bleeds to modal edges, same pattern as GameSummaryModal */}
      <div className="relative -mx-6 -mt-6 h-44 overflow-hidden rounded-t-2xl">
        {game.header_image ? (
          // Comes into focus where the backlog was flicking past.
          <div className="absolute inset-0 animate-reveal motion-reduce:animate-overlay-in">
            <GameArt src={game.header_image} alt="" sizes="(max-width: 640px) 100vw, 544px" />
          </div>
        ) : (
          <div className="w-full h-full bg-ink-800 flex items-center justify-center">
            <Gamepad2 className="w-10 h-10 text-ink-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
        <div className="absolute bottom-3 left-6 right-12">
          <h2 className="text-xl font-semibold tracking-tight text-ink-50 leading-tight line-clamp-2">
            {game.name}
          </h2>
          {/* What kind of game it is, under its name; the tags below describe it. */}
          {game.genres && game.genres.length > 0 && (
            <p className="mt-1 text-sm text-ink-300">{game.genres.slice(0, 2).join(' · ')}</p>
          )}
        </div>
      </div>

      <div className="space-y-4 mt-5 animate-result-in [animation-delay:150ms] motion-reduce:animate-none">
        {/* AI badge */}
        <div className="flex items-center gap-2 text-sm">
          {random ? (
            <Dices className="w-4 h-4 text-accent-400 shrink-0" aria-hidden="true" />
          ) : (
            <Sparkles className="w-4 h-4 text-accent-400 shrink-0" aria-hidden="true" />
          )}
          <p className="text-ink-100 font-medium">{random ? 'Left to chance' : 'Picked for you'}</p>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
          {game.main_story_hours ? (
            <TimeToBeat hours={game.main_story_hours} iconClassName="w-3.5 h-3.5" />
          ) : null}
          <GameRating
            criticScore={game.critic_score}
            criticCount={game.critic_count}
            steamScore={game.steam_review_score}
            steamCount={game.steam_review_count}
            iconClassName="w-3.5 h-3.5"
          />
          {game.playtime_forever >= 60 ? (
            <Playtime
              compact
              minutes={game.playtime_forever}
              lastPlayedAt={game.last_played_at}
              iconClassName="w-3.5 h-3.5"
            />
          ) : null}
          {storeUrl && (
            <a
              href={storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 ml-auto hover:text-ink-300 transition-colors"
            >
              <span>Steam</span> <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Tags */}
        {game.tags && game.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {game.tags.slice(0, 6).map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-ink-800 text-xs text-ink-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* AI reasoning */}
        {reasoning && <p className="text-sm text-ink-300 leading-relaxed">{reasoning}</p>}

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <Button onClick={onPick} disabled={isLoading} className="flex-1 cursor-pointer">
            {mode === 'queue' ? 'Add to Queue' : 'Start Playing'}
          </Button>
          <Button
            variant="secondary"
            onClick={onReroll}
            disabled={isOnCooldown || isLoading}
            className="cursor-pointer tabular-nums"
            title={
              isOnCooldown
                ? `Wait ${cooldownRemaining}s`
                : random
                  ? 'Roll for another game'
                  : 'Get another suggestion'
            }
          >
            <RotateCcw
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isOnCooldown ? `${cooldownRemaining}s` : random ? 'Roll again' : 'Reroll'}</span>
          </Button>
        </div>
      </div>
    </>
  );
}
