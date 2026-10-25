'use client';

import { Modal } from '@/components/ui/Modal';
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

  const handlePick = () => {
    if (suggestion) {
      onPick(
        suggestion.game.app_id,
        suggestion.game.name,
        suggestion.game.header_image,
        suggestion.game.main_story_hours,
      );
      onClose();
    }
  };

  const isWizardStep = step === 'mood' || step === 'energy' || step === 'time';

  // Rendered only while open (see the home page), so each opening starts from
  // a fresh wizard and a late response can't land in a closed modal.
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" ariaLabel="Pick your next game">
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
    </Modal>
  );
}
