'use client';

import { useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useSuggestion } from '@/hooks/useSuggestion';
import { SuggestionWizard } from './SuggestionWizard';
import { SuggestionResult } from './SuggestionResult';
import { SuggestionLoading } from './SuggestionLoading';
import { SuggestionError } from './SuggestionError';

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (
    appId: number,
    name: string,
    headerImage: string | null,
    mainStoryHours: number | null,
  ) => void;
  mode?: 'play' | 'queue';
  showHistoryWarning?: boolean;
}

export function SuggestionModal({
  isOpen,
  onClose,
  onPick,
  mode = 'play',
  showHistoryWarning = false,
}: SuggestionModalProps) {
  const {
    step,
    suggestion,
    error,
    cooldownRemaining,
    selectMood,
    selectEnergy,
    selectTime,
    goBack,
    reroll,
    reset,
    isLoading,
  } = useSuggestion();

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      reset();
    }
  }, [isOpen, reset]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handlePick = useCallback(() => {
    if (suggestion) {
      onPick(
        suggestion.game.app_id,
        suggestion.game.name,
        suggestion.game.header_image,
        suggestion.game.main_story_hours,
      );
      onClose();
    }
  }, [suggestion, onPick, onClose]);

  if (!isOpen) return null;

  const isWizardStep = step === 'mood' || step === 'energy' || step === 'time';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4 bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer z-10"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Content */}
        <div className="p-6">
          {isWizardStep && (
            <SuggestionWizard
              step={step}
              onSelectMood={selectMood}
              onSelectEnergy={selectEnergy}
              onSelectTime={selectTime}
              onBack={goBack}
              showHistoryWarning={showHistoryWarning}
            />
          )}

          {step === 'loading' && <SuggestionLoading />}

          {step === 'result' && error && <SuggestionError error={error} onRetry={reset} />}

          {step === 'result' && suggestion && !error && (
            <SuggestionResult
              suggestion={suggestion}
              onPick={handlePick}
              onReroll={reroll}
              cooldownRemaining={cooldownRemaining}
              isLoading={isLoading}
              mode={mode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
