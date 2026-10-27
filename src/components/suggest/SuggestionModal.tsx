'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import type { CarouselPools } from '@/lib/data/loaders';
import { useSuggestion } from '@/hooks/useSuggestion';
import { SuggestionWizard } from './SuggestionWizard';
import { SuggestionResult } from './SuggestionResult';
import { SuggestionLoading } from './SuggestionLoading';
import { SuggestionError } from './SuggestionError';
import type { SuggestionResult as Suggestion } from '@/lib/suggest/types';

// How many games' art flicks past while a game is picked.
const SHUFFLE_COVERS = 12;

/** Art from the backlog games Home already has, in a random order. */
function backlogCovers(pools: CarouselPools | undefined): string[] {
  if (!pools) return [];
  const games = [
    ...pools.pickUpPool,
    ...(pools.moreLike?.games ?? []),
    ...pools.shortGamesPool,
    ...pools.weekendGamesPool,
    ...pools.highlyRatedGamesPool,
    ...pools.hiddenGemsPool,
    ...pools.recentlyAddedPool,
  ];
  const covers = [...new Set(games.flatMap((g) => (g.header_image ? [g.header_image] : [])))];
  for (let i = covers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [covers[i], covers[j]] = [covers[j], covers[i]];
  }
  return covers.slice(0, SHUFFLE_COVERS);
}

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (game: Suggestion['game']) => void;
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
    retry,
    reset,
    isLoading,
  } = useSuggestion();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Picked once per opening, so the shuffle doesn't change mid-flick.
  const [covers] = useState(() =>
    backlogCovers(
      user
        ? queryClient.getQueryData<CarouselPools>(queryKeys.carousels.byUser(user.id))
        : undefined,
    ),
  );

  const handlePick = () => {
    if (suggestion) {
      onPick(suggestion.game);
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

      {step === 'loading' && <SuggestionLoading covers={covers} />}

      {step === 'result' && error && (
        <SuggestionError error={error} onRetry={retry} onStartOver={reset} />
      )}

      {step === 'result' && suggestion && !error && (
        <SuggestionResult
          // A reroll's game comes into focus like the first.
          key={suggestion.game.id}
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
