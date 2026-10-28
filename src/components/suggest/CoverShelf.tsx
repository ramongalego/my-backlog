import { GameArt } from '@/components/games/GameArt';

/**
 * The backlog Pick My Game picks from, as a tilted wall of art: across the top
 * of the questions, and in Home's band while nothing is playing. A small
 * backlog repeats round the wall, offset row by row so a game doesn't sit next
 * to itself. Fills its (positioned) parent; `rows` of four fill a taller one.
 */
export function CoverShelf({
  covers,
  rows = 3,
  className = '',
}: {
  covers: string[];
  rows?: number;
  /** On the wall itself, e.g. a hover zoom. */
  className?: string;
}) {
  if (covers.length === 0) return null;
  const tiles = Array.from(
    { length: rows * 4 },
    (_, i) => covers[(i + Math.floor(i / 4)) % covers.length],
  );
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
      <div
        className={`absolute -inset-x-[20%] -top-[30%] grid grid-cols-4 gap-1.5 -rotate-6 animate-overlay-in ${className}`}
      >
        {tiles.map((src, i) => (
          <div key={i} className="relative aspect-[460/215] overflow-hidden rounded-md bg-ink-800">
            <GameArt src={src} alt="" sizes="(max-width: 640px) 35vw, 180px" />
          </div>
        ))}
      </div>
    </div>
  );
}
