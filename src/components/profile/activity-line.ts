import {
  Clock,
  Heart,
  HeartOff,
  ListMinus,
  ListPlus,
  MonitorSmartphone,
  Pause,
  PenLine,
  Plus,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { STATUS_STYLE } from '@/lib/games/status-style';
import { playedFor, type ActivityKind, type ActivityLine } from '@/lib/account/activity';

// How each thing done to a game is said and drawn, on the player's own Recent
// activity and on the feed others see. No 'use client': the feed is drawn on
// the server.

// A status keeps its color, as everywhere else; everything else stays neutral.
export const NEUTRAL = 'text-ink-300';

export const ACTIVITY_LINE: Record<
  ActivityKind,
  { icon: LucideIcon; text: string; what: (line: ActivityLine) => string }
> = {
  // Every line is in the past tense. Only the game still being played has its
  // start in the playing color.
  playing: { ...STATUS_STYLE.playing, what: () => 'Started playing' },
  started: { icon: STATUS_STYLE.playing.icon, text: NEUTRAL, what: () => 'Started playing' },
  finished: { ...STATUS_STYLE.finished, what: () => 'Finished' },
  dropped: { ...STATUS_STYLE.dropped, what: () => 'Dropped' },
  backlog: { ...STATUS_STYLE.backlog, what: () => 'Moved to backlog' },
  wont_play: { ...STATUS_STYLE.wont_play, what: () => "Marked Won't Play" },
  added: { icon: Plus, text: NEUTRAL, what: () => 'Added to backlog' },
  queued: { icon: ListPlus, text: NEUTRAL, what: () => 'Added to queue' },
  paused: { icon: Pause, text: NEUTRAL, what: () => 'Paused, moved to queue' },
  unqueued: { icon: ListMinus, text: NEUTRAL, what: () => 'Taken off the queue' },
  // The rating is the line: no second star at its end.
  rated: {
    icon: Star,
    text: NEUTRAL,
    what: (line) => `${line.changed ? 'Changed rating to' : 'Rated'} ${line.rating}/10`,
  },
  // The platform icon, as on the Games page's platform filter (not the logo's gamepad).
  moved: { icon: MonitorSmartphone, text: NEUTRAL, what: (line) => `Moved to ${line.to}` },
  favorite: { icon: Heart, text: NEUTRAL, what: () => 'Added to favorites' },
  unfavorite: { icon: HeartOff, text: NEUTRAL, what: () => 'Removed from favorites' },
  note: { icon: PenLine, text: NEUTRAL, what: () => 'Wrote a note' },
  played: {
    icon: Clock,
    text: NEUTRAL,
    what: (line) => `Played ${playedFor(line.minutes ?? 0)}`,
  },
};
