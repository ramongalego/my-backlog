'use client';

import Image from 'next/image';
import { Gamepad2, RotateCcw, Clock, Sparkles } from 'lucide-react';
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
    <div className='flex flex-col items-center py-4'>
      <div className='flex items-center gap-2 mb-6'>
        <Sparkles className='w-5 h-5 text-amber-400' />
        <p className='text-zinc-400 text-sm'>AI Recommendation</p>
      </div>

      {/* Game card */}
      <div className='w-full max-w-sm bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800'>
        <div className='relative h-44'>
          {game.header_image ? (
            <Image
              src={game.header_image}
              alt={game.name}
              fill
              className='object-cover'
              sizes='384px'
            />
          ) : (
            <div className='w-full h-full bg-zinc-800 flex items-center justify-center'>
              <Gamepad2 className='w-12 h-12 text-zinc-700' />
            </div>
          )}
        </div>

        <div className='p-5'>
          <h3 className='text-xl font-semibold text-zinc-100 mb-1'>
            {game.name}
          </h3>

          <div className='flex flex-wrap items-center gap-3 text-sm text-zinc-500 mb-4'>
            {game.main_story_hours && (
              <span className='flex items-center gap-1'>
                <Clock className='w-4 h-4' />
                {game.main_story_hours}h to beat
              </span>
            )}
            {game.genres && game.genres.length > 0 && (
              <span>{game.genres.slice(0, 2).join(', ')}</span>
            )}
          </div>

          {/* AI reasoning */}
          <div className='bg-zinc-800/50 rounded-lg p-3 mb-5'>
            <p className='text-sm text-zinc-300 leading-relaxed'>{reasoning}</p>
          </div>

          {/* Action buttons */}
          <div className='flex gap-3'>
            <Button
              onClick={onPick}
              disabled={isLoading}
              className='flex-1 cursor-pointer'
            >
              Pick This
            </Button>
            <button
              onClick={onReroll}
              disabled={isOnCooldown || isLoading}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg border transition-colors cursor-pointer ${
                isOnCooldown || isLoading
                  ? 'bg-zinc-800 border-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100'
              }`}
              title={
                isOnCooldown
                  ? `Wait ${cooldownRemaining}s`
                  : 'Get another suggestion'
              }
            >
              <RotateCcw
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
              />
              {isOnCooldown ? `${cooldownRemaining}s` : 'Reroll'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
