'use client';

import { ChevronLeft, Dices } from 'lucide-react';
import { QuestionStep } from './QuestionStep';
import { MOOD_QUESTION, ENERGY_QUESTION, TIME_QUESTION } from '@/lib/suggest/questions';
import type { MoodType, EnergyLevel, TimeCommitment } from '@/lib/suggest/types';

type WizardStep = 'mood' | 'energy' | 'time';

interface SuggestionWizardProps {
  step: WizardStep;
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
  onSelectMood,
  onSelectEnergy,
  onSelectTime,
  onBack,
  showHistoryWarning = false,
  onLeaveToChance,
}: SuggestionWizardProps) {
  // Progress indicator
  const stepNumber = step === 'mood' ? 1 : step === 'energy' ? 2 : 3;
  const canGoBack = step !== 'mood';

  return (
    <div className="flex flex-col items-center py-4">
      {/* Header with back button and progress */}
      <div className="flex items-center justify-center w-full mb-8 relative">
        {/* Back button */}
        {canGoBack && (
          <button
            onClick={onBack}
            className="absolute left-0 flex items-center gap-1 text-ink-500 hover:text-ink-300 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">Back</span>
          </button>
        )}

        {/* Progress dots */}
        <div className="flex items-center gap-2">
          {[1, 2, 3].map((num) => (
            <div
              key={num}
              className={`w-2 h-2 rounded-full transition-colors ${
                num === stepNumber ? 'bg-ink-100' : num < stepNumber ? 'bg-ink-500' : 'bg-ink-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Question content */}
      {step === 'mood' && (
        <QuestionStep
          title={MOOD_QUESTION.title}
          options={MOOD_QUESTION.options}
          onSelect={onSelectMood}
        />
      )}

      {step === 'energy' && (
        <QuestionStep
          title={ENERGY_QUESTION.title}
          options={ENERGY_QUESTION.options}
          onSelect={onSelectEnergy}
        />
      )}

      {step === 'time' && (
        <QuestionStep
          title={TIME_QUESTION.title}
          options={TIME_QUESTION.options}
          onSelect={onSelectTime}
        />
      )}

      {/* Instead of answering: a quiet way out, under the first question. */}
      {step === 'mood' && onLeaveToChance && (
        <button
          type="button"
          onClick={onLeaveToChance}
          className="mt-5 flex items-center gap-2 py-2 text-sm text-ink-400 hover:text-ink-100 transition-colors cursor-pointer"
        >
          <Dices className="w-4 h-4" aria-hidden="true" />
          <span>Or leave it to chance</span>
        </button>
      )}

      {/* History warning — shown on all steps */}
      {showHistoryWarning && (
        <p className="text-xs text-ink-500 text-center mt-6">
          Suggestions improve as you finish, drop, and rate more games.
        </p>
      )}
    </div>
  );
}
