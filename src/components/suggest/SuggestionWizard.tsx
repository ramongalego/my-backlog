'use client';

import { useId } from 'react';
import { ChevronLeft, Dices } from 'lucide-react';
import { QuestionStep } from './QuestionStep';
import { CoverShelf } from './CoverShelf';
import {
  MOOD_QUESTION,
  ENERGY_QUESTION,
  TIME_QUESTION,
  answeredOptions,
} from '@/lib/suggest/questions';
import type {
  MoodType,
  EnergyLevel,
  TimeCommitment,
  SuggestionPreferences,
} from '@/lib/suggest/types';

type WizardStep = 'mood' | 'energy' | 'time';

const QUESTION = { mood: MOOD_QUESTION, energy: ENERGY_QUESTION, time: TIME_QUESTION };

interface SuggestionWizardProps {
  step: WizardStep;
  /** Your answers so far, for the trail over the question. */
  answers?: Partial<SuggestionPreferences>;
  /** Backlog art for the wall behind the question. */
  covers?: string[];
  onSelectMood: (mood: MoodType) => void;
  onSelectEnergy: (energy: EnergyLevel) => void;
  onSelectTime: (time: TimeCommitment) => void;
  onBack: () => void;
  showHistoryWarning?: boolean;
  /** Skips the questions for a random game (Pick My Next Game, for the queue). */
  onLeaveToChance?: () => void;
}

export function SuggestionWizard({
  step,
  answers = {},
  covers = [],
  onSelectMood,
  onSelectEnergy,
  onSelectTime,
  onBack,
  showHistoryWarning = false,
  onLeaveToChance,
}: SuggestionWizardProps) {
  const headingId = useId();
  const stepNumber = step === 'mood' ? 1 : step === 'energy' ? 2 : 3;
  // Only the questions before this one: going back keeps a later answer in
  // `answers` until it's answered again.
  const trail = answeredOptions({
    mood: answers.mood,
    energy: stepNumber > 2 ? answers.energy : undefined,
  }).slice(0, stepNumber - 1);

  return (
    <div>
      {/* The question over the backlog it picks from, bleeding to the dialog's edges. */}
      <div className="relative -mx-4 -mt-4 sm:-mx-6 sm:-mt-6 mb-5 overflow-hidden rounded-t-2xl">
        {covers.length > 0 && (
          <>
            <CoverShelf covers={covers} />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900 from-20% via-ink-900/70 to-ink-900/10" />
          </>
        )}

        {step !== 'mood' && (
          // Mirrors the dialog's close button across the top.
          <button
            type="button"
            onClick={onBack}
            className="absolute top-3 left-3 z-10 p-2 rounded-full bg-ink-950/60 text-ink-200 hover:bg-ink-950/85 hover:text-ink-50 transition-colors cursor-pointer"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>
        )}

        <div className="relative px-4 sm:px-6 pt-24 sm:pt-32">
          <div className="flex items-center gap-3 text-sm text-ink-300">
            {/* Done in ember, like Home's backlog progress; this one light. */}
            <div className="flex shrink-0 gap-1" aria-hidden="true">
              {[1, 2, 3].map((num) => (
                <span
                  key={num}
                  className={`h-1 w-6 rounded-full transition-colors duration-300 ${
                    num < stepNumber
                      ? 'bg-accent-500'
                      : num === stepNumber
                        ? 'bg-ink-100'
                        : 'bg-ink-50/20'
                  }`}
                />
              ))}
            </div>
            <span className="sr-only">Question {stepNumber} of 3</span>
            {trail.length > 0 && (
              <p className="truncate">
                <span className="sr-only">Your answers: </span>
                {trail.map((option) => option.short ?? option.label).join(' · ')}
              </p>
            )}
          </div>
          <h2
            key={step}
            id={headingId}
            className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight text-ink-50 animate-result-in motion-reduce:animate-none"
          >
            {QUESTION[step].title}
          </h2>
        </div>
      </div>

      {step === 'mood' && (
        <QuestionStep
          key="mood"
          labelledBy={headingId}
          options={MOOD_QUESTION.options}
          onSelect={onSelectMood}
        />
      )}
      {step === 'energy' && (
        <QuestionStep
          key="energy"
          labelledBy={headingId}
          options={ENERGY_QUESTION.options}
          onSelect={onSelectEnergy}
        />
      )}
      {step === 'time' && (
        <QuestionStep
          key="time"
          labelledBy={headingId}
          options={TIME_QUESTION.options}
          onSelect={onSelectTime}
        />
      )}

      {/* Instead of answering: under the first question, the way out. */}
      {step === 'mood' && onLeaveToChance && (
        <button
          type="button"
          onClick={onLeaveToChance}
          style={{ animationDelay: '220ms' }}
          className="group mt-2.5 flex w-full items-center gap-3 rounded-xl border border-dashed border-ink-700 px-4 py-3 text-left transition-colors hover:border-ink-500 hover:bg-ink-800/40 cursor-pointer animate-result-in motion-reduce:animate-none"
        >
          <Dices
            className="w-5 h-5 shrink-0 text-ink-300 transition-colors group-hover:text-accent-400"
            aria-hidden="true"
          />
          <span className="min-w-0">
            <span className="block font-medium text-ink-100">Leave it to chance</span>
            <span className="block text-sm text-ink-400">
              Skip the questions for a random backlog game
            </span>
          </span>
        </button>
      )}

      {showHistoryWarning && (
        <p className="mt-5 text-xs text-ink-500 text-center">
          Suggestions improve as you finish, drop, and rate more games
        </p>
      )}
    </div>
  );
}
