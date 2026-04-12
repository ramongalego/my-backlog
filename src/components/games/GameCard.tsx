'use client';

import Image from 'next/image';
import { Archive, Ban, Check, EyeOff, Gamepad2, ListOrdered, Pencil, Play, Star, X } from 'lucide-react';
import type { GameItem } from '@/hooks/useGamesPage';
import { GameCardInfo } from './GameCardInfo';

interface GameCardProps {
  game: GameItem;
  onOpenDetail: (appId: number) => void;
  queued?: boolean;
}

const STATUS_BADGE: Record<
  string,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  finished: { label: 'Finished', className: 'bg-emerald-950/95 text-emerald-400', icon: Check },
  playing: { label: 'Playing', className: 'bg-sky-950/95 text-sky-400', icon: Play },
  dropped: { label: 'Dropped', className: 'bg-rose-950/95 text-rose-400', icon: X },
  wont_play: { label: "Won't Play", className: 'bg-amber-950/95 text-amber-400', icon: Ban },
  hidden: { label: 'Hidden', className: 'bg-zinc-900/95 text-zinc-400', icon: EyeOff },
  backlog: { label: 'Backlog', className: 'bg-violet-950/95 text-violet-400', icon: Archive },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_BADGE[status];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <div
      className={`px-2 py-0.5 ${config.className} text-xs font-medium rounded flex items-center gap-1`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      {config.label}
    </div>
  );
}

export function GameCard({ game, onOpenDetail, queued }: GameCardProps) {
  const status = game.status ?? 'backlog';

  return (
    <div className="group bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-all sm:hover:scale-[1.02]">
      {/* Clickable image area */}
      <button
        onClick={() => onOpenDetail(game.app_id)}
        className="cursor-pointer relative h-40 sm:h-36 w-full block focus:outline-none select-none"
        aria-label={`Open details for ${game.name}`}
      >
        {game.header_image ? (
          <Image
            src={game.header_image}
            alt={game.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
            draggable={false}
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

        {queued ? (
          <div
            className="absolute top-2 right-2 px-2 py-0.5 bg-sky-950/95 text-sky-400 text-xs font-medium rounded flex items-center gap-1"
            title="In playing queue"
          >
            <ListOrdered className="w-3 h-3" aria-hidden="true" />
            Queued
          </div>
        ) : (
          <div className="absolute top-2 right-2">
            <StatusBadge status={status} />
          </div>
        )}
        {game.status === 'finished' && game.rating != null && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-zinc-950/90 text-xs font-medium rounded flex items-center gap-1">
            <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" aria-hidden="true" />
            <span className="text-zinc-200">{game.rating}/10</span>
          </div>
        )}
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
          deckCompat={game.deck_compat}
        />
      </div>
    </div>
  );
}
