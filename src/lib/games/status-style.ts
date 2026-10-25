import { Archive, Ban, Check, EyeOff, Play, X, type LucideIcon } from 'lucide-react';

export type GameStatus = 'backlog' | 'playing' | 'finished' | 'dropped' | 'wont_play' | 'hidden';

export const GAME_STATUSES: GameStatus[] = [
  'backlog',
  'playing',
  'finished',
  'dropped',
  'wont_play',
  'hidden',
];

/**
 * The one place a game status gets its label, icon and colours. Playing uses
 * the accent, finished and dropped use their semantic colours, and the
 * "parked" statuses (backlog, won't play, hidden) stay neutral.
 *
 * - `text`: status-coloured text, for badges on a dark chip.
 * - `solid`: the selected state of a status control.
 * - `fill`: bars, legend dots and chart series.
 */
export const STATUS_STYLE: Record<
  GameStatus,
  { label: string; icon: LucideIcon; text: string; solid: string; fill: string }
> = {
  backlog: {
    label: 'Backlog',
    icon: Archive,
    text: 'text-ink-300',
    solid: 'bg-ink-100 text-ink-950',
    fill: 'bg-ink-500',
  },
  playing: {
    label: 'Playing',
    icon: Play,
    text: 'text-accent-400',
    solid: 'bg-accent-500 text-ink-950',
    fill: 'bg-accent-500',
  },
  finished: {
    label: 'Finished',
    icon: Check,
    text: 'text-emerald-400',
    solid: 'bg-emerald-500 text-ink-950',
    fill: 'bg-emerald-500',
  },
  dropped: {
    label: 'Dropped',
    icon: X,
    text: 'text-rose-400',
    solid: 'bg-rose-500 text-ink-950',
    fill: 'bg-rose-500',
  },
  wont_play: {
    label: "Won't Play",
    icon: Ban,
    text: 'text-ink-300',
    solid: 'bg-ink-100 text-ink-950',
    fill: 'bg-ink-700',
  },
  hidden: {
    label: 'Hidden',
    icon: EyeOff,
    text: 'text-ink-300',
    solid: 'bg-ink-100 text-ink-950',
    fill: 'bg-ink-700',
  },
};
