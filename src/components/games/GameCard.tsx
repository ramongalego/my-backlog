'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Clock, Gamepad2, Star, Undo2, Check, X, EyeOff } from 'lucide-react';
import type { GameItem } from '@/hooks/useGamesPage';

interface GameCardProps {
  game: GameItem;
  onStatusChange: (appId: number, status: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    finished: { label: 'Finished', className: 'bg-emerald-500/90' },
    dropped: { label: 'Dropped', className: 'bg-zinc-600/90' },
    hidden: { label: 'Hidden', className: 'bg-zinc-700/90' },
  }[status];

  if (!config) return null;

  return (
    <div className={`absolute top-2 right-2 px-2 py-0.5 ${config.className} text-white text-xs font-medium rounded`}>
      {config.label}
    </div>
  );
}

function BacklogActions({ game, onStatusChange }: GameCardProps) {
  return (
    <div className='absolute inset-0 bg-black/60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 sm:gap-2'>
      <button
        onClick={() => onStatusChange(game.app_id, 'finished')}
        className='cursor-pointer flex items-center gap-1.5 sm:gap-1 px-4 sm:px-2 py-2.5 sm:py-1.5 bg-emerald-600/80 hover:bg-emerald-600 rounded-lg sm:rounded transition-colors'
        title='Mark as finished'
      >
        <Check className='w-5 sm:w-3.5 h-5 sm:h-3.5 text-white' />
        <span className='text-white text-sm sm:text-xs font-medium'>Finish</span>
      </button>
      <button
        onClick={() => onStatusChange(game.app_id, 'dropped')}
        className='cursor-pointer flex items-center gap-1.5 sm:gap-1 px-4 sm:px-2 py-2.5 sm:py-1.5 bg-zinc-600/80 hover:bg-zinc-600 rounded-lg sm:rounded transition-colors'
        title='Mark as dropped'
      >
        <X className='w-5 sm:w-3.5 h-5 sm:h-3.5 text-white' />
        <span className='text-white text-sm sm:text-xs font-medium'>Drop</span>
      </button>
      <button
        onClick={() => onStatusChange(game.app_id, 'hidden')}
        className='cursor-pointer flex items-center gap-1.5 sm:gap-1 px-4 sm:px-2 py-2.5 sm:py-1.5 bg-zinc-700/80 hover:bg-zinc-700 rounded-lg sm:rounded transition-colors'
        title='Hide game'
      >
        <EyeOff className='w-5 sm:w-3.5 h-5 sm:h-3.5 text-zinc-300' />
        <span className='text-zinc-300 text-sm sm:text-xs font-medium'>Hide</span>
      </button>
    </div>
  );
}

function RestoreAction({ game, onStatusChange }: GameCardProps) {
  const label = game.status === 'hidden' ? 'Unhide' : 'Move to Backlog';

  return (
    <button
      onClick={() => onStatusChange(game.app_id, 'backlog')}
      className='cursor-pointer absolute inset-0 bg-black/60 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2'
    >
      <Undo2 className='w-4 h-4 text-white' />
      <span className='text-white font-medium text-sm'>{label}</span>
    </button>
  );
}

export const GameCard = memo(function GameCard({ game, onStatusChange }: GameCardProps) {
  const isBacklog = !game.status || game.status === 'backlog';
  const hasCompletedStatus = game.status === 'finished' || game.status === 'dropped' || game.status === 'hidden';

  return (
    <div className='group bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all sm:hover:scale-[1.02]'>
      <div className='relative h-40 sm:h-28'>
        {game.header_image ? (
          <Image
            src={game.header_image}
            alt={game.name}
            fill
            className='object-cover'
            sizes='(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw'
          />
        ) : (
          <div className='w-full h-full bg-zinc-800 flex items-center justify-center'>
            <Gamepad2 className='w-8 h-8 text-zinc-700' />
          </div>
        )}

        {game.status && <StatusBadge status={game.status} />}

        {hasCompletedStatus && (
          <RestoreAction game={game} onStatusChange={onStatusChange} />
        )}

        {isBacklog && (
          <BacklogActions game={game} onStatusChange={onStatusChange} />
        )}
      </div>

      <div className='p-3'>
        <h3 className='text-zinc-100 font-medium text-sm truncate' title={game.name}>
          {game.name}
        </h3>
        <div className='flex items-center gap-3 mt-2 text-xs text-zinc-500'>
          {game.main_story_hours && (
            <span className='flex items-center gap-1' title='Time to beat'>
              <Clock className='w-3 h-3' />
              {game.main_story_hours}h
            </span>
          )}
          {game.steam_review_score && (
            <span
              className='flex items-center gap-1'
              title={`Steam reviews${game.steam_review_count ? ` (${game.steam_review_count.toLocaleString()} reviews)` : ''}`}
            >
              <Star className='w-3 h-3' />
              {game.steam_review_score}%
            </span>
          )}
          {game.playtime_forever > 0 && (
            <span className='text-zinc-600' title='Played'>
              {Math.round(game.playtime_forever / 60)}h played
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
