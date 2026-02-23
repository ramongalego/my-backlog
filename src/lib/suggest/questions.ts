import type { LucideIcon } from 'lucide-react';
import {
  Zap,
  Leaf,
  Lightbulb,
  Heart,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  Timer,
  CalendarDays,
  Mountain,
} from 'lucide-react';
import type { MoodType, EnergyLevel, TimeCommitment } from './types';

export interface QuestionOption<T> {
  value: T;
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  description: string;
}

export interface Question<T> {
  id: string;
  title: string;
  options: QuestionOption<T>[];
}

export const MOOD_QUESTION: Question<MoodType> = {
  id: 'mood',
  title: 'What do you want to FEEL right now?',
  options: [
    {
      value: 'adrenaline',
      icon: Zap,
      iconClassName: 'text-orange-400',
      label: 'Adrenaline',
      description: 'Fast, demanding, focus-heavy, skill based',
    },
    {
      value: 'relaxed',
      icon: Leaf,
      iconClassName: 'text-emerald-400',
      label: 'Relaxed',
      description: 'Low pressure, cozy, forgiving, no stress',
    },
    {
      value: 'engaged',
      icon: Lightbulb,
      iconClassName: 'text-yellow-400',
      label: 'Engaged',
      description: 'Thinking, planning, problem-solving',
    },
    {
      value: 'emotional',
      icon: Heart,
      iconClassName: 'text-rose-400',
      label: 'Emotional',
      description: 'Story-first, atmosphere, character-driven',
    },
  ],
};

export const ENERGY_QUESTION: Question<EnergyLevel> = {
  id: 'energy',
  title: 'How much mental energy do you have?',
  options: [
    {
      value: 'high',
      icon: BatteryFull,
      iconClassName: 'text-emerald-400',
      label: 'High',
      description: 'Learn systems, think, optimize',
    },
    {
      value: 'medium',
      icon: BatteryMedium,
      iconClassName: 'text-yellow-400',
      label: 'Medium',
      description: 'Familiar mechanics, light thinking',
    },
    {
      value: 'low',
      icon: BatteryLow,
      iconClassName: 'text-red-400',
      label: 'Low',
      description: 'Brain-off, react-only, comfy',
    },
  ],
};

export const TIME_QUESTION: Question<TimeCommitment> = {
  id: 'time',
  title: "Time commitment you're willing to make?",
  options: [
    {
      value: 'short',
      icon: Timer,
      iconClassName: 'text-blue-400',
      label: 'One session (1–5h)',
      description: 'Quick wins, roguelikes, short games',
    },
    {
      value: 'medium',
      icon: CalendarDays,
      iconClassName: 'text-violet-400',
      label: 'A few nights (5–12h)',
      description: 'Weekend-sized adventures',
    },
    {
      value: 'long',
      icon: Mountain,
      iconClassName: 'text-zinc-400',
      label: 'Long haul (20h+)',
      description: 'Deep dives, RPGs, big campaigns',
    },
  ],
};

export const QUESTIONS = [MOOD_QUESTION, ENERGY_QUESTION, TIME_QUESTION] as const;
