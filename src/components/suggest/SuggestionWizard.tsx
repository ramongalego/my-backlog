'use client';

import { ChevronLeft } from 'lucide-react';
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
}

export function SuggestionWizard({
  step,
  onSelectMood,
  onSelectEnergy,
  onSelectTime,
  onBack,
  showHistoryWarning = false,
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
            className="absolute left-0 flex items-center gap-1 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
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
                num === stepNumber
                  ? 'bg-zinc-100'
                  : num < stepNumber
                    ? 'bg-zinc-500'
                    : 'bg-zinc-700'
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

      {/* History warning — shown on all steps */}
      {showHistoryWarning && (
        <p className="text-xs text-zinc-500 text-center mt-6">
          Suggestions improve as you finish, drop, and rate more games.
        </p>
      )}
    </div>
  );
}
