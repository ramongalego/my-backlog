'use client';

import { memo } from 'react';
import Image from 'next/image';
import { Clock, Gamepad2, Star, ExternalLink, Pencil } from 'lucide-react';
import type { GameItem } from '@/hooks/useGamesPage';

interface GameCardProps {
  game: GameItem;
  onOpenDetail: (appId: number) => void;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  finished: { label: 'Finished', className: 'bg-emerald-500/90' },
  dropped: { label: 'Dropped', className: 'bg-zinc-600/90' },
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
        <a
          href={`https://store.steampowered.com/app/${game.app_id}/`}
          target="_blank"
          rel="noopener noreferrer"
          title={game.name}
          className="group/title flex items-center gap-1 text-zinc-200 font-medium hover:text-white transition-colors cursor-pointer"
        >
          <span className="truncate min-w-0">{game.name}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity mb-px" />
        </a>
        <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
          {game.main_story_hours && (
            <span className="flex items-center gap-1" title="Time to beat">
              <Clock className="w-3 h-3" />
              {game.main_story_hours}h
            </span>
          )}
          {game.steam_review_score && (
            <span
              className="flex items-center gap-1"
              title={`Steam reviews${game.steam_review_count ? ` (${game.steam_review_count.toLocaleString()} reviews)` : ''}`}
            >
              <Star className="w-3 h-3" />
              {(game.steam_review_score / 10).toFixed(1)}
            </span>
          )}
          {game.playtime_forever > 0 && (
            <span className="text-zinc-600" title="Played">
              {Math.round(game.playtime_forever / 60)}h played
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
