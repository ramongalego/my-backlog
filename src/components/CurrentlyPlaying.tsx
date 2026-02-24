'use client';

import Image from 'next/image';
import { ExternalLink, Archive } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Game {
  app_id: number;
  name: string;
  header_image: string | null;
  main_story_hours: number;
  playtime_forever: number;
}

interface CurrentlyPlayingProps {
  game: Game;
  onFinish: () => void;
  onDrop: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CurrentlyPlaying({
  game,
  onFinish,
  onDrop,
  onCancel,
  isLoading,
}: CurrentlyPlayingProps) {
  return (
    <div className="w-full max-w-md mx-auto">
      <p className="text-sm text-zinc-500 uppercase tracking-wide mb-3 text-center">
        Currently Playing
      </p>
      <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
        <div className="relative h-48">
          {game.header_image ? (
            <Image
              src={game.header_image}
              alt={game.name}
              fill
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
            <ExternalLink className="w-4 h-4 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity" />
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
                      <span className="text-zinc-500">{game.main_story_hours}h to beat</span>
                    </div>
                    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{
                          width: `${Math.min((game.playtime_forever / 60 / game.main_story_hours) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </>
                )
              ) : (
                <p className="text-zinc-500 text-sm">{game.main_story_hours}h to beat</p>
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
              Finish
            </Button>
            <Button
              onClick={onDrop}
              disabled={isLoading}
              variant="secondary"
              className="flex-1 cursor-pointer"
            >
              Drop
            </Button>
          </div>
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="mt-5 w-full flex items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-400 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5" />
            Move to Backlog
          </button>
        </div>
      </div>
    </div>
  );
}
