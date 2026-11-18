import { Star } from 'lucide-react';

/** The player's own rating, out of 10. `onArt` puts it on a dark chip to sit over art. */
export function Rating({
  rating,
  size = 'sm',
  onArt = false,
  drawn = false,
  className = '',
}: {
  rating: number;
  size?: 'sm' | 'md';
  onArt?: boolean;
  /**
   * Drawn by CSS and hidden from screen readers, for a control whose name
   * already says the rating where it would be out of order as text in it.
   */
  drawn?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden={drawn || undefined}
      className={`inline-flex items-center gap-1 font-medium tabular-nums text-ink-200 ${
        onArt ? 'px-2 py-0.5 rounded-md bg-ink-950/90 text-xs' : 'text-sm'
      } ${className}`}
    >
      <Star
        className={`${size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} shrink-0 fill-amber-400 text-amber-400`}
        aria-hidden="true"
      />
      {drawn ? (
        <span data-chip={`${rating}/10`} className="before:content-[attr(data-chip)]" />
      ) : (
        <span>{rating}/10</span>
      )}
    </span>
  );
}
