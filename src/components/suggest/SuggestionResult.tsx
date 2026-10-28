'use client';

import { Dices, RotateCcw, Sparkles, ExternalLink } from 'lucide-react';
import { ArtHeader } from '@/components/games/ArtHeader';
import { GameRating, Playtime, TimeToBeat } from '@/components/games/GameCardInfo';
import { Button } from '@/components/ui/Button';
import { steamStoreUrl } from '@/lib/games/store-link';
import { steamLastPlayed } from '@/lib/games/consoles';
import type {
  SuggestionPreferences,
  SuggestionResult as SuggestionResultType,
} from '@/lib/suggest/types';
import { AnswerLine } from './AnswerLine';

interface SuggestionResultProps {
  suggestion: SuggestionResultType;
  onPick: () => void;
  onReroll: () => void;
  cooldownRemaining: number;
  isLoading: boolean;
  mode?: 'play' | 'queue';
  /** Picked at random, not for your answers: no reasoning, and Roll again. */
  random?: boolean;
  /** What it was picked for, over the reasoning. */
  answers?: Partial<SuggestionPreferences>;
}

export function SuggestionResult({
  suggestion,
  onPick,
  onReroll,
  cooldownRemaining,
  isLoading,
  mode = 'play',
  random = false,
  answers = {},
}: SuggestionResultProps) {
  const { game, reasoning } = suggestion;
  const isOnCooldown = cooldownRemaining > 0;
  const storeUrl = steamStoreUrl(game);

  return (
    <>
      {/* The art comes into focus where the backlog was flicking past. Under
          the name, what kind of game it is; the tags below describe it. */}
      <ArtHeader
        src={game.header_image}
        title={game.name}
        subtitle={game.genres?.length ? game.genres.slice(0, 2).join(' · ') : undefined}
        artClassName="animate-reveal motion-reduce:animate-overlay-in"
      />

      <div className="space-y-4 mt-5 animate-result-in [animation-delay:150ms] motion-reduce:animate-none">
        {/* Why this game: your answers, or that it was left to chance. */}
        {random ? (
          <div className="flex items-center gap-2 text-sm">
            <Dices className="w-4 h-4 text-accent-400 shrink-0" aria-hidden="true" />
            <p className="text-ink-100 font-medium">Left to chance</p>
          </div>
        ) : answers.mood ? (
          <AnswerLine answers={answers} />
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Sparkles className="w-4 h-4 text-accent-400 shrink-0" aria-hidden="true" />
            <p className="text-ink-100 font-medium">Picked for you</p>
          </div>
        )}

        {/* Why it was picked for you, straight under what you asked for. */}
        {reasoning && <p className="text-ink-200 leading-relaxed">{reasoning}</p>}

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
              lastPlayedAt={steamLastPlayed(game)}
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
