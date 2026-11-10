import { ListOrdered } from 'lucide-react';

/**
 * On a game's art: it's in your playing queue. On the Games page and in the
 * Home rows, which still show queued games so a row lists every game that
 * fits it.
 */
export function QueuedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ink-950/90 text-ink-200 text-xs font-medium ${className}`}
      title="In playing queue"
    >
      <ListOrdered className="w-3 h-3" aria-hidden="true" />
      <span>Queued</span>
    </span>
  );
}
