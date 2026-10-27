import { Tooltip, TooltipText } from '@/components/ui/Tooltip';
import { upcomingRelease } from '@/lib/games/release-date';

/**
 * "Out Nov 5" on the art of a game that isn't out yet, beside its console
 * tag and in the same neutral style; the full date and a countdown are in the
 * tooltip. Nothing once the game is out.
 */
export function ReleaseBadge({ releaseDate }: { releaseDate: string | null | undefined }) {
  const upcoming = upcomingRelease(releaseDate);
  if (!upcoming) return null;
  return (
    <Tooltip
      content={<TooltipText title={upcoming.detail} />}
      className="h-5 max-w-full rounded-md bg-ink-950/90 px-1.5 text-xs font-medium text-ink-100"
    >
      <span className="truncate">{upcoming.label}</span>
    </Tooltip>
  );
}
