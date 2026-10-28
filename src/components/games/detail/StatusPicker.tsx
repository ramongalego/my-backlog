import { ListOrdered } from 'lucide-react';
import { STATUS_STYLE, type GameStatus } from '@/lib/games/status-style';

/** A game's status, or Queue, which takes Playing's place while another game is played. */
export type DetailStatus = GameStatus | 'queue';

const STATUS_BUTTON =
  'cursor-pointer flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap';
const STATUS_IDLE = 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50';

/** The status pills: one per place the game can go. */
export function StatusPicker({
  options,
  value,
  onChange,
  replacesPlaying,
}: {
  options: DetailStatus[];
  value: DetailStatus;
  onChange: (status: DetailStatus) => void;
  /** Starting this game sends the one being played back to the backlog: say so. */
  replacesPlaying: string | null;
}) {
  return (
    <div>
      <p className="text-sm font-medium text-ink-300 mb-2" id="status-label">
        Status
      </p>
      <div
        role="group"
        aria-labelledby="status-label"
        className={`grid gap-2 grid-cols-3 ${options.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-6'}`}
      >
        {options.map((option) => {
          const isActive = value === option;
          const {
            icon: Icon,
            label,
            solid,
          } = option === 'queue'
            ? { icon: ListOrdered, label: 'Queue', solid: STATUS_STYLE.playing.solid }
            : STATUS_STYLE[option];
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={isActive}
              className={`${STATUS_BUTTON} ${isActive ? solid : STATUS_IDLE}`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
      {replacesPlaying && (
        <p className="mt-2 text-xs text-ink-400">{replacesPlaying} goes back to your backlog.</p>
      )}
    </div>
  );
}
