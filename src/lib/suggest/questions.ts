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
      label: 'Adrenaline',
      description: 'Fast, demanding, focus-heavy, skill based',
    },
    {
      value: 'relaxed',
      icon: Leaf,
      label: 'Relaxed',
      description: 'Low pressure, cozy, forgiving, no stress',
    },
    {
      value: 'engaged',
      icon: Lightbulb,
      label: 'Engaged',
      description: 'Thinking, planning, problem-solving',
    },
    {
      value: 'emotional',
      icon: Heart,
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
      label: 'High',
      description: 'Learn systems, think, optimize',
    },
    {
      value: 'medium',
      icon: BatteryMedium,
      label: 'Medium',
      description: 'Familiar mechanics, light thinking',
    },
    {
      value: 'low',
      icon: BatteryLow,
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
      label: 'One session (1–5h)',
      description: 'Quick wins, roguelikes, short games',
    },
    {
      value: 'medium',
      icon: CalendarDays,
      label: 'A few nights (5–12h)',
      description: 'Weekend-sized adventures',
    },
    {
      value: 'long',
      icon: Mountain,
      label: 'Long haul (20h+)',
      description: 'Deep dives, RPGs, big campaigns',
    },
  ],
};

export const QUESTIONS = [MOOD_QUESTION, ENERGY_QUESTION, TIME_QUESTION] as const;
