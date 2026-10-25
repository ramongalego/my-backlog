import { STATUS_STYLE, type GameStatus } from '@/lib/games/status-style';

/**
 * Small status chip for game art and lists. Playing is solid accent so the
 * game you're on stands out; other statuses are coloured text on a dark chip.
 * Backlog is the default state, so pass `showBacklog` only where it isn't implied.
 */
export function StatusBadge({
  status,
  showBacklog = false,
}: {
  status: GameStatus;
  showBacklog?: boolean;
}) {
  if (status === 'backlog' && !showBacklog) return null;
  const { label, icon: Icon, text, solid } = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
        status === 'playing' ? solid : `bg-ink-950/90 ${text}`
      }`}
    >
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
