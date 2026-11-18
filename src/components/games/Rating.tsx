import { Star } from 'lucide-react';

/** The player's own rating, out of 10. `onArt` puts it on a dark chip to sit over art. */
export function Rating({
  rating,
  size = 'sm',
  onArt = false,
  className = '',
}: {
  rating: number;
  size?: 'sm' | 'md';
  onArt?: boolean;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-medium tabular-nums text-ink-200 ${
        onArt ? 'px-2 py-0.5 rounded-md bg-ink-950/90 text-xs' : 'text-sm'
      } ${className}`}
    >
      <Star
        className={`${size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} shrink-0 fill-amber-400 text-amber-400`}
        aria-hidden="true"
      />
      <span>{rating}/10</span>
    </span>
  );
}
