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
}

export function SuggestionResult({
  suggestion,
  onPick,
  onReroll,
  cooldownRemaining,
  isLoading,
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
            sizes="(max-width: 640px) 100vw, 512px"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Gamepad2 className="w-10 h-10 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
        <h2 className="absolute bottom-3 left-6 right-12 text-xl font-bold text-white leading-tight line-clamp-2">
          {game.name}
        </h2>
      </div>

      <div className="space-y-4 mt-5">
        {/* AI badge */}
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
          <p className="text-zinc-400 uppercase tracking-wider font-medium">Picked for you</p>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
          {game.main_story_hours && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {game.main_story_hours}h
            </span>
          )}
          {game.steam_review_score && (
            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5" />
              {(game.steam_review_score / 10).toFixed(1)}
            </span>
          )}
          {game.genres && game.genres.length > 0 && (
            <span>{game.genres.slice(0, 2).join(', ')}</span>
          )}
          <a
            href={`https://store.steampowered.com/app/${game.app_id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 ml-auto hover:text-zinc-300 transition-colors"
          >
            Steam <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Tags */}
        {game.tags && game.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {game.tags.slice(0, 6).map((tag) => (
              <span key={tag} className="px-2 py-0.5 rounded-md bg-zinc-800 text-xs text-zinc-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* AI reasoning */}
        <p className="text-sm text-zinc-300 leading-relaxed">{reasoning}</p>

        {/* Action buttons */}
        <div className="flex gap-3 pt-1">
          <Button onClick={onPick} disabled={isLoading} className="flex-1 cursor-pointer">
            Start Playing
          </Button>
          <button
            onClick={onReroll}
            disabled={isOnCooldown || isLoading}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors cursor-pointer ${
              isOnCooldown || isLoading
                ? 'border-zinc-700 text-zinc-500 cursor-not-allowed'
                : 'border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
            }`}
            title={isOnCooldown ? `Wait ${cooldownRemaining}s` : 'Get another suggestion'}
          >
            <RotateCcw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isOnCooldown ? `${cooldownRemaining}s` : 'Reroll'}
          </button>
        </div>
      </div>
    </>
  );
}
