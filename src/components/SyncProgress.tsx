'use client';

import Image from 'next/image';
import type { Game, SyncProgress as SyncProgressType } from '@/types/games';

interface SyncProgressProps {
  progress: SyncProgressType;
  games: Game[];
}

export function SyncProgress({ progress, games }: SyncProgressProps) {
  const currentGame = games[progress.current - 1];
  const percentComplete = progress.total > 0
    ? (progress.current / progress.total) * 100
    : 0;

  return (
    <div className='w-full max-w-md space-y-6'>
      <div className='space-y-3'>
        <div className='h-2 bg-zinc-800 rounded-full overflow-hidden'>
          <div
            className='h-full bg-linear-to-r from-violet-500 to-fuchsia-500 transition-all duration-200'
            style={{ width: `${percentComplete}%` }}
            role="progressbar"
            aria-valuenow={progress.current}
            aria-valuemin={0}
            aria-valuemax={progress.total}
          />
        </div>
        <p className='text-zinc-400 text-sm'>
          Analyzing game {progress.current} of {progress.total}...
        </p>
      </div>

      {currentGame && (
        <div className='relative rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900'>
          <div className='relative aspect-460/215 bg-zinc-800'>
            <div className='absolute inset-0 flex items-center justify-center p-4'>
              <p className='text-zinc-400 text-center font-medium truncate max-w-full'>
                {currentGame.name}
              </p>
            </div>
            <Image
              src={`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${currentGame.app_id}/header.jpg`}
              alt={currentGame.name}
              fill
              className='object-cover'
              sizes='448px'
            />
            {/* Scan line animation */}
            <div className='absolute inset-0 overflow-hidden'>
              <div
                className='absolute left-0 right-0 h-1 bg-linear-to-b from-violet-500/80 via-violet-400/40 to-transparent animate-scan'
              />
            </div>
            {/* Grid overlay */}
            <div
              className='absolute inset-0 opacity-20'
              style={{
                backgroundImage:
                  'linear-gradient(0deg, transparent 24%, rgba(139, 92, 246, 0.3) 25%, rgba(139, 92, 246, 0.3) 26%, transparent 27%, transparent 74%, rgba(139, 92, 246, 0.3) 75%, rgba(139, 92, 246, 0.3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(139, 92, 246, 0.3) 25%, rgba(139, 92, 246, 0.3) 26%, transparent 27%, transparent 74%, rgba(139, 92, 246, 0.3) 75%, rgba(139, 92, 246, 0.3) 76%, transparent 77%, transparent)',
                backgroundSize: '20px 20px',
              }}
            />
            {/* Corner brackets */}
            <div className='absolute top-2 left-2 w-6 h-6 border-l-2 border-t-2 border-violet-500' />
            <div className='absolute top-2 right-2 w-6 h-6 border-r-2 border-t-2 border-violet-500' />
            <div className='absolute bottom-2 left-2 w-6 h-6 border-l-2 border-b-2 border-violet-500' />
            <div className='absolute bottom-2 right-2 w-6 h-6 border-r-2 border-b-2 border-violet-500' />
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scan {
          0% {
            top: 0%;
          }
          50% {
            top: 100%;
          }
          50.1% {
            top: 0%;
          }
          100% {
            top: 100%;
          }
        }
        .animate-scan {
          animation: scan 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
