/**
 * The console a game added by hand is on, as a small chip on its art. Purely
 * visual (the name is in the game's meta row for screen readers).
 */
export function ConsoleBadge({ platform }: { platform: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 max-w-full items-center rounded-md bg-ink-950/90 px-1.5 text-xs font-medium text-ink-100"
    >
      <span className="truncate">{platform}</span>
    </span>
  );
}
