'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Gamepad2, Pencil } from 'lucide-react';
import type { GameItem } from '@/hooks/useGamesPage';
import { GameCardInfo } from './GameCardInfo';

interface GameCardProps {
  game: GameItem;
  onOpenDetail: (appId: number) => void;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  finished: { label: 'Finished', className: 'bg-emerald-500/90' },
  playing: { label: 'Playing', className: 'bg-sky-500/90' },
  dropped: { label: 'Dropped', className: 'bg-rose-500/90' },
  hidden: { label: 'Hidden', className: 'bg-zinc-700/90' },
  backlog: { label: 'Backlog', className: 'bg-violet-600/90' },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_BADGE[status];
  if (!config) return null;
  return (
    <div
      className={`absolute top-2 right-2 px-2 py-0.5 ${config.className} text-white text-xs font-medium rounded`}
    >
      {config.label}
    </div>
  );
}

export const GameCard = memo(function GameCard({ game, onOpenDetail }: GameCardProps) {
  const status = game.status ?? 'backlog';

  return (
    <div className="group bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all sm:hover:scale-[1.02]">
      {/* Clickable image area */}
      <button
        onClick={() => onOpenDetail(game.app_id)}
        className="cursor-pointer relative h-40 sm:h-36 w-full block"
        aria-label={`Open details for ${game.name}`}
      >
        {game.header_image ? (
          <Image
            src={game.header_image}
            alt={game.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Gamepad2 className="w-8 h-8 text-zinc-700" />
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
          <Pencil className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
        </div>

        <StatusBadge status={status} />
      </button>

      {/* Card info */}
      <div className="p-4">
        <GameCardInfo
          appId={game.app_id}
          name={game.name}
          mainStoryHours={game.main_story_hours}
          steamReviewScore={game.steam_review_score}
          steamReviewCount={game.steam_review_count}
          playtimeMinutes={game.playtime_forever}
        />
      </div>
    </div>
  );
});
