'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { COVER_ASPECT } from '@/components/games/CoverArt';
import type { Game, SyncProgress as SyncProgressType } from '@/types/games';

interface SyncProgressProps {
  progress: SyncProgressType;
  games: Game[];
}

export function SyncProgress({ progress, games }: SyncProgressProps) {
  const currentGame = games[progress.current - 1];
  const percentComplete = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  // Games go by faster than their covers load, so each cover loads out of
  // sight and replaces the one on screen only once it's ready. Otherwise most
  // frames would be the bare name.
  const [cover, setCover] = useState<{ src: string; name: string; order: number } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const nextSrc = currentGame?.header_image ?? null;
  const nextName = currentGame?.name ?? '';
  const order = progress.current;
  useEffect(() => {
    if (!nextSrc) return;
    const img = new window.Image();
    img.onload = () => {
      // A slow cover that arrives after a later one has no business replacing it.
      if (mounted.current) {
        setCover((shown) =>
          shown && shown.order > order ? shown : { src: nextSrc, name: nextName, order },
        );
      }
    };
    img.src = nextSrc;
  }, [nextSrc, nextName, order]);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,30rem)_1fr] md:gap-10 md:items-center">
      <div className={`relative ${COVER_ASPECT} overflow-hidden rounded-xl bg-ink-900`}>
        {currentGame && (
          <>
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <p className="text-ink-500 text-center font-medium truncate max-w-full">
                {currentGame.name}
              </p>
            </div>
            {cover && (
              // Already in the browser cache, so it's shown as is rather than
              // re-fetched through the image optimizer.
              <Image src={cover.src} alt={cover.name} fill unoptimized className="object-cover" />
            )}
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
