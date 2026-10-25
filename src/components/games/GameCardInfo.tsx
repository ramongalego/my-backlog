import { Clock, ExternalLink, ThumbsUp } from 'lucide-react';
import { steamReviewTitle } from '@/lib/steam/review-label';
import { SteamDeckBadge } from './SteamDeckBadge';

/**
 * Steam's review score the way Steam shows it: percent positive with a
 * thumbs-up (not a star, which the app uses for your own rating). The label
 * and review count are on hover.
 */
export function SteamScore({
  score,
  count,
  iconClassName = 'w-3 h-3',
}: {
  score: number;
  count?: number | null;
  iconClassName?: string;
}) {
  const title = steamReviewTitle(score, count);
  return (
    <span className="flex items-center gap-1" title={title}>
      <ThumbsUp className={iconClassName} aria-hidden="true" />
      <span>{score}%</span>
      <span className="sr-only"> on Steam ({title})</span>
    </span>
  );
}

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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
      {mainStoryHours ? (
        <span className="flex items-center gap-1" title="Time to beat">
          <Clock className="w-3 h-3" aria-hidden="true" />
          <span>{mainStoryHours}h</span>
        </span>
      ) : null}
      {steamReviewScore ? <SteamScore score={steamReviewScore} count={steamReviewCount} /> : null}
      {playtimeMinutes >= 60 ? (
        <span
          className={`text-ink-500${hidePlaytimeOnMobile ? ' hidden sm:inline' : ''}`}
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
        className="group/title flex items-center gap-1 text-ink-100 font-medium hover:text-ink-50 transition-colors cursor-pointer"
      >
        <span className="truncate min-w-0">{name}</span>
        <ExternalLink
          className="w-3 h-3 shrink-0 opacity-0 group-hover/title:opacity-100 transition-opacity mb-px"
          aria-hidden="true"
        />
      </a>
      <div className="mt-1">
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
