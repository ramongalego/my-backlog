import { Clock, Star, ExternalLink } from 'lucide-react';
import { SteamDeckBadge } from './SteamDeckBadge';

interface GameMetaRowProps {
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  playtimeMinutes?: number;
  deckCompat?: number | null;
  hidePlaytimeOnMobile?: boolean;
}

export function GameMetaRow({
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  playtimeMinutes = 0,
  deckCompat,
  hidePlaytimeOnMobile,
}: GameMetaRowProps) {
  if (!mainStoryHours && !steamReviewScore && playtimeMinutes < 60 && !deckCompat) return null;
  return (
    <div className="flex items-center gap-3 text-xs text-zinc-500">
      {mainStoryHours ? (
        <span className="flex items-center gap-1" title="Time to beat">
          <Clock className="w-3 h-3" />
          {mainStoryHours}h
        </span>
      ) : null}
      {steamReviewScore ? (
        <span
          className="flex items-center gap-1"
          title={`Steam reviews${steamReviewCount ? ` (${steamReviewCount.toLocaleString()} reviews)` : ''}`}
        >
          <Star className="w-3 h-3" />
          {(steamReviewScore / 10).toFixed(1)}
        </span>
      ) : null}
      {playtimeMinutes >= 60 ? (
        <span
          className={`text-zinc-600${hidePlaytimeOnMobile ? ' hidden sm:inline' : ''}`}
          title="Time played"
        >
          {Math.round(playtimeMinutes / 60)}h played
        </span>
      ) : null}
      <SteamDeckBadge deckCompat={deckCompat} />
    </div>
  );
}

interface GameCardInfoProps {
  appId: number;
  name: string;
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  playtimeMinutes?: number;
  deckCompat?: number | null;
}

export function GameCardInfo({
  appId,
  name,
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  playtimeMinutes = 0,
  deckCompat,
}: GameCardInfoProps) {
  return (
    <>
      <a
        href={`https://store.steampowered.com/app/${appId}/`}
        target="_blank"
        rel="noopener noreferrer"
        title={name}
        className="group/title flex items-center gap-1 text-zinc-200 font-medium hover:text-white transition-colors cursor-pointer"
      >
        <span className="truncate min-w-0">{name}</span>
        <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity mb-px" />
      </a>
      <div className="mt-2">
        <GameMetaRow
          mainStoryHours={mainStoryHours}
          steamReviewScore={steamReviewScore}
          steamReviewCount={steamReviewCount}
          playtimeMinutes={playtimeMinutes}
          deckCompat={deckCompat}
        />
      </div>
    </>
  );
}
