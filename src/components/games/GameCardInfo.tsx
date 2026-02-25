import { Clock, Star, ExternalLink } from 'lucide-react';

interface GameCardInfoProps {
  appId: number;
  name: string;
  mainStoryHours?: number | null;
  steamReviewScore?: number | null;
  steamReviewCount?: number | null;
  playtimeMinutes?: number;
}

export function GameCardInfo({
  appId,
  name,
  mainStoryHours,
  steamReviewScore,
  steamReviewCount,
  playtimeMinutes = 0,
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
      <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
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
          <span className="text-zinc-600" title="Time played">
            {Math.round(playtimeMinutes / 60)}h played
          </span>
        ) : null}
      </div>
    </>
  );
}
