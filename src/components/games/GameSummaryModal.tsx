'use client';

import Image from 'next/image';
import { Gamepad2, Trophy, TrendingUp, TrendingDown, Check, Star } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export interface GameSummaryData {
  gameName: string;
  headerImage: string | null;
  startedAt: string | null;
  finishedAt: string;
  playtimeMinutes: number;
  mainStoryHours: number | null;
  rating: number | null;
}

interface GameSummaryModalProps extends GameSummaryData {
  isOpen: boolean;
  onClose: () => void;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
};

export function GameSummaryModal({
  isOpen,
  onClose,
  gameName,
  headerImage,
  startedAt,
  finishedAt,
  playtimeMinutes,
  mainStoryHours,
  rating,
}: GameSummaryModalProps) {
  const steamHours = Math.round((playtimeMinutes / 60) * 10) / 10;

  const startedDate = startedAt ? startedAt.slice(0, 10) : null;
  let daysPlayed: number | null = null;
  if (startedDate && finishedAt) {
    const diff = Math.round(
      (isoToDate(finishedAt).getTime() - isoToDate(startedDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    daysPlayed = Math.max(1, diff);
  }

  const hoursPerDay =
    daysPlayed && daysPlayed > 1 && steamHours > 0
      ? Math.round((steamHours / daysPlayed) * 10) / 10
      : null;

  type EstimateInfo = {
    icon: React.ReactNode;
    color: string;
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
        color: 'text-emerald-400',
        value: 'Right on',
        middle: `the ~${mainStoryHours}h estimate`,
        pct: null,
      };
    } else if (diff > 0) {
      estimate = {
        icon: <TrendingUp className="w-4 h-4 shrink-0 text-amber-400" />,
        color: 'text-amber-400',
        value: `${absDiff}h`,
        middle: `over the ~${mainStoryHours}h estimate`,
        pct: `(+${pct}%)`,
      };
    } else {
      estimate = {
        icon: <TrendingDown className="w-4 h-4 shrink-0 text-emerald-400" />,
        color: 'text-emerald-400',
        value: `${absDiff}h`,
        middle: `under the ~${mainStoryHours}h estimate`,
        pct: `(−${pct}%)`,
      };
    }
  }

  const statBlocks = [
    daysPlayed !== null
      ? { value: String(daysPlayed), label: daysPlayed === 1 ? 'day played' : 'days played' }
      : null,
    steamHours > 0 ? { value: `${steamHours}h`, label: 'of playtime' } : null,
    hoursPerDay !== null ? { value: `${hoursPerDay}h`, label: 'avg per day' } : null,
  ].filter((b): b is { value: string; label: string } => b !== null);

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

        {/* Stat blocks */}
        {statBlocks.length > 0 && (
          <div className={`grid gap-3 ${GRID_COLS[statBlocks.length] ?? 'grid-cols-3'}`}>
            {statBlocks.map((block) => (
              <div
                key={block.label}
                className="bg-zinc-800 rounded-xl p-4 text-center border border-zinc-700"
              >
                <p className="text-2xl font-bold text-zinc-100">{block.value}</p>
                <p className="text-xs text-zinc-500 mt-1">{block.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Estimate comparison */}
        {estimate && (
          <div data-testid="estimate-text" className="flex items-center gap-2 text-sm">
            {estimate.icon}
            <span className="flex items-center gap-1">
              <span className="font-semibold text-zinc-100">{estimate.value}</span>
              <span className="text-zinc-400">{estimate.middle}</span>
              {estimate.pct && <span className="font-semibold text-zinc-100">{estimate.pct}</span>}
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
      </div>
    </Modal>
  );
}
