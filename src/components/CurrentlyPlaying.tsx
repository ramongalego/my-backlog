'use client';

import Image from 'next/image';
import { ExternalLink, Archive, Check, Star, Clock, ListOrdered, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SteamDeckBadge } from '@/components/games/SteamDeckBadge';

interface Game {
  app_id: number;
  name: string;
  header_image: string | null;
  main_story_hours: number;
  playtime_forever: number;
  steam_review_score?: number | null;
  deck_compat?: number | null;
}

interface CurrentlyPlayingProps {
  game: Game;
  onFinish: () => void;
  onDrop: () => void;
  onCancel: () => void;
  onMoveToQueue: () => void;
  isLoading?: boolean;
}

export function CurrentlyPlaying({
  game,
  onFinish,
  onDrop,
  onCancel,
  onMoveToQueue,
  isLoading,
}: CurrentlyPlayingProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm text-zinc-500 uppercase tracking-wide mb-3 text-center">Now Playing</p>
      <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
        <div className="relative h-48">
          {game.header_image ? (
            <Image
              src={game.header_image}
              alt={game.name}
              fill
              priority
              className="object-cover"
              sizes="448px"
            />
          ) : (
            <div className="w-full h-full bg-zinc-800" />
          )}
        </div>
        <div className="p-5">
          <a
            href={`https://store.steampowered.com/app/${game.app_id}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="group/title inline-flex items-center gap-1.5 text-xl font-semibold text-zinc-100 mb-1 hover:text-white transition-colors cursor-pointer"
          >
            {game.name}
            <ExternalLink
              className="w-4 h-4 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity"
              aria-hidden="true"
            />
          </a>
          {game.main_story_hours > 0 && (
            <div className="mb-5">
              {game.playtime_forever >= 60 ? (
                game.playtime_forever / 60 >= game.main_story_hours ? (
                  <p className="text-sm">
                    <span className="text-amber-400">
                      {Math.round(game.playtime_forever / 60)}h played
                    </span>
                    <span className="text-zinc-500">
                      {' '}
                      · past the ~{game.main_story_hours}h estimate
                    </span>
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between text-sm mb-1.5">
                      <span className="text-zinc-400">
                        {Math.round(game.playtime_forever / 60)}h played
                      </span>
                      <span className="text-zinc-500">~{game.main_story_hours}h to beat</span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{
                          width: `${Math.min((game.playtime_forever / 60 / game.main_story_hours) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </>
                )
              ) : (
                <div className="flex items-center justify-center gap-3 text-sm text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>{game.main_story_hours}h</span>
                  </span>
                  {game.steam_review_score != null && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3" aria-hidden="true" />
                      <span>{(game.steam_review_score / 10).toFixed(1)}</span>
                    </span>
                  )}
                  <SteamDeckBadge deckCompat={game.deck_compat} />
                </div>
              )}
            </div>
          )}
          <div className="flex gap-3">
            <Button
              onClick={onFinish}
              disabled={isLoading}
              variant="success"
              className="flex-1 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Finish</span>
            </Button>
            <Button
              onClick={onDrop}
              disabled={isLoading}
              variant="danger"
              className="flex-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
              <span>Drop</span>
            </Button>
          </div>
          <div className="mt-5 flex items-center justify-center gap-6">
            <button
              onClick={onMoveToQueue}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-400 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Move to Queue</span>
            </button>
            <button
              onClick={onCancel}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-400 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Move to Backlog</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
