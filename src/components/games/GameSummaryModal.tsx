'use client';

import Image from 'next/image';
import {
  Gamepad2,
  Trophy,
  TrendingUp,
  TrendingDown,
  Check,
  Star,
  ChevronRight,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export interface GameSummaryData {
  gameName: string;
  headerImage: string | null;
  playtimeMinutes: number;
  mainStoryHours: number | null;
  rating: number | null;
  gamesFinished: number;
  totalGames: number;
  backlogHoursRemoved: number | null;
  nextGame: string | null;
}

interface GameSummaryModalProps extends GameSummaryData {
  isOpen: boolean;
  onClose: () => void;
}

export function GameSummaryModal({
  isOpen,
  onClose,
  gameName,
  headerImage,
  playtimeMinutes,
  mainStoryHours,
  rating,
  gamesFinished,
  totalGames,
  backlogHoursRemoved,
  nextGame,
}: GameSummaryModalProps) {
  const steamHours = Math.round((playtimeMinutes / 60) * 10) / 10;

  type EstimateInfo = {
    icon: React.ReactNode;
    value: string;
    middle: string;
    pct: string | null;
  };
  let estimate: EstimateInfo | null = null;
  if (mainStoryHours && mainStoryHours > 0 && steamHours > 0) {
    const diff = steamHours - mainStoryHours;
    const absDiff = Math.round(Math.abs(diff) * 10) / 10;
    const pct = Math.abs(Math.round((diff / mainStoryHours) * 100));
    if (absDiff < 0.5) {
      estimate = {
        icon: <Check className="w-4 h-4 shrink-0 text-emerald-400" />,
        value: 'Right on',
        middle: `the ~${mainStoryHours}h estimate`,
        pct: null,
      };
    } else if (diff > 0) {
      estimate = {
        icon: <TrendingUp className="w-4 h-4 shrink-0 text-amber-400" />,
        value: `${absDiff}h`,
        middle: `over the ~${mainStoryHours}h estimate`,
        pct: `(+${pct}%)`,
      };
    } else {
      estimate = {
        icon: <TrendingDown className="w-4 h-4 shrink-0 text-emerald-400" />,
        value: `${absDiff}h`,
        middle: `under the ~${mainStoryHours}h estimate`,
        pct: `(−${pct}%)`,
      };
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {/* Hero */}
      <div className="relative -mx-6 -mt-6 h-44 overflow-hidden rounded-t-2xl">
        {headerImage ? (
          <Image
            src={headerImage}
            alt={gameName}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Gamepad2 className="w-10 h-10 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
        <h2 className="absolute bottom-3 left-6 right-12 text-xl font-bold text-white leading-tight line-clamp-2">
          {gameName}
        </h2>
      </div>

      <div className="space-y-5 mt-5">
        {/* Tagline */}
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-zinc-400 uppercase tracking-wider font-medium">You finished it!</p>
        </div>

        {/* Playtime + estimate */}
        {steamHours > 0 && (
          <div data-testid="estimate-text" className="flex items-center gap-2 text-sm">
            {estimate ? estimate.icon : null}
            <span className="flex items-center gap-1 flex-wrap">
              <span className="font-semibold text-zinc-100">{steamHours}h of playtime</span>
              {estimate && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">
                    {estimate.value === 'Right on'
                      ? 'right on'
                      : `${estimate.value} ${estimate.middle}`}
                  </span>
                  {estimate.pct && (
                    <span className="font-semibold text-zinc-100">{estimate.pct}</span>
                  )}
                </>
              )}
            </span>
          </div>
        )}

        {/* Rating */}
        {rating !== null && (
          <div className="flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-400">You rated it</span>
              <span className="text-zinc-100 font-semibold">{rating}</span>
              <span className="text-zinc-500">/ 10</span>
            </span>
          </div>
        )}

        {/* Impact stats */}
        {(totalGames > 0 || backlogHoursRemoved) && (
          <div className="flex divide-x divide-zinc-800 py-3">
            {totalGames > 0 && (
              <div className={`text-center ${backlogHoursRemoved ? 'flex-1 pr-3' : 'w-full'}`}>
                <p className="text-2xl font-bold text-zinc-100">
                  {gamesFinished}/{totalGames}
                </p>
                <p className="text-xs text-zinc-500 mt-1">games finished</p>
              </div>
            )}
            {backlogHoursRemoved && (
              <div className={`text-center ${totalGames > 0 ? 'flex-1 pl-3' : 'w-full'}`}>
                <p className="text-2xl font-bold text-emerald-400">-{backlogHoursRemoved}h</p>
                <p className="text-xs text-zinc-500 mt-1">from backlog</p>
              </div>
            )}
          </div>
        )}

        {/* Next up */}
        {nextGame && (
          <div className="flex items-center gap-2 text-sm">
            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-zinc-400">Next up:</span>
            <span className="font-semibold text-zinc-100 truncate pr-1">{nextGame}</span>
          </div>
        )}
      </div>
    </Modal>
  );
}
