'use client';

import Image from 'next/image';
import type { Game, SyncProgress as SyncProgressType } from '@/types/games';

interface SyncProgressProps {
  progress: SyncProgressType;
  games: Game[];
}

export function SyncProgress({ progress, games }: SyncProgressProps) {
  const currentGame = games[progress.current - 1];
  const percentComplete = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] md:gap-10 md:items-center">
      <div className="relative aspect-460/215 overflow-hidden rounded-xl bg-ink-900">
        {currentGame && (
          <>
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <p className="text-ink-500 text-center font-medium truncate max-w-full">
                {currentGame.name}
              </p>
            </div>
            <Image
              key={currentGame.app_id}
              src={`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${currentGame.app_id}/header.jpg`}
              alt={currentGame.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 480px"
            />
          </>
        )}
      </div>

      <div className="min-w-0 max-w-md">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink-50">
          Setting up your library
        </h2>
        <p className="mt-2 text-ink-400">
          Looking up how long each of your games takes to beat and how well it&apos;s reviewed.
        </p>
        <div className="mt-6 h-1.5 bg-ink-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-500 rounded-full transition-[width] duration-200"
            style={{ width: `${percentComplete}%` }}
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-label="Library setup progress"
          />
        </div>
        <p className="mt-2 text-ink-400 text-sm">
          Analyzing game {progress.current} of {progress.total}...
        </p>
      </div>
    </div>
  );
}
