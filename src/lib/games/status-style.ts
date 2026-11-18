import { Archive, Ban, Check, EyeOff, Play, X, type LucideIcon } from 'lucide-react';
import type { GameStatus } from './status';

/**
 * `text` is for badges on a dark chip, `solid` for a selected status control,
 * `fill` for bars, legend dots and chart series.
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
