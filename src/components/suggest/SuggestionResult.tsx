'use client';

import Image from 'next/image';
import { Gamepad2, RotateCcw, Clock, Sparkles, ExternalLink, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SuggestionResult as SuggestionResultType } from '@/lib/suggest/types';

interface SuggestionResultProps {
  suggestion: SuggestionResultType;
  onPick: () => void;
  onReroll: () => void;
  cooldownRemaining: number;
  isLoading: boolean;
  mode?: 'play' | 'queue';
}

export function SuggestionResult({
  suggestion,
  onPick,
  onReroll,
  cooldownRemaining,
  isLoading,
  mode = 'play',
}: SuggestionResultProps) {
  const { game, reasoning } = suggestion;
  const isOnCooldown = cooldownRemaining > 0;

  return (
    <>
      {/* Hero — bleeds to modal edges, same pattern as GameSummaryModal */}
      <div className="relative -mx-6 -mt-6 h-44 overflow-hidden rounded-t-2xl">
        {game.header_image ? (
          <Image
            src={game.header_image}
            alt={game.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 544px"
          />
        ) : (
          <div className="w-full h-full bg-ink-800 flex items-center justify-center">
            <Gamepad2 className="w-10 h-10 text-ink-500" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
        <h2 className="absolute bottom-3 left-6 right-12 text-xl font-semibold tracking-tight text-ink-50 leading-tight line-clamp-2">
          {game.name}
        </h2>
      </div>

      <div className="space-y-4 mt-5">
        {/* AI badge */}
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-accent-400 shrink-0" />
          <p className="text-ink-100 font-medium">Picked for you</p>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
          {game.main_story_hours && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>{game.main_story_hours}h</span>
            </span>
          )}
          {game.steam_review_score && (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5" />
              <span>{(game.steam_review_score / 10).toFixed(1)}</span>
            </span>
          )}
          {game.genres && game.genres.length > 0 && (
            <span>{game.genres.slice(0, 2).join(', ')}</span>
          )}
          <a
            href={`https://store.steampowered.com/app/${game.app_id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 ml-auto hover:text-ink-300 transition-colors"
          >
            <span>Steam</span> <ExternalLink className="w-3 h-3" />
          </a>
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
        <p className="text-sm text-ink-300 leading-relaxed">{reasoning}</p>

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
            title={isOnCooldown ? `Wait ${cooldownRemaining}s` : 'Get another suggestion'}
          >
            <RotateCcw
              className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>{isOnCooldown ? `${cooldownRemaining}s` : 'Reroll'}</span>
          </Button>
        </div>
      </div>
    </>
  );
}
