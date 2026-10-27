'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/hooks/useAuth';
import { queryKeys } from '@/lib/query-keys';
import { backlogCovers, type CarouselPools } from '@/hooks/useCarouselPools';
import { useSuggestion } from '@/hooks/useSuggestion';
import { SuggestionWizard } from './SuggestionWizard';
import { SuggestionResult } from './SuggestionResult';
import { SuggestionLoading } from './SuggestionLoading';
import { SuggestionError } from './SuggestionError';
import type { SuggestionResult as Suggestion } from '@/lib/suggest/types';
import type { QueueItem } from '@/types/games';
import { createClient } from '@/lib/supabase/client';
import { findRandomBacklogGame, RANDOM_ROLL_MS, type RandomGame } from '@/lib/games/random-pick';
import { prefersReducedMotion } from '@/lib/motion';

/** Leaving it to chance: rolling, then the game it landed on (or why it couldn't). */
type Chance =
  | { phase: 'rolling' }
  | { phase: 'result'; game: RandomGame; roll: number }
  | { phase: 'error'; message: string };

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
  // Picked once per opening, so the shuffle doesn't change mid-flick. Queued
  // games aren't picked, so they don't flick past either.
  const [covers] = useState(() => {
    if (!user) return [];
    const queue = queryClient.getQueryData<QueueItem[]>(queryKeys.queue.list(user.id)) ?? [];
    return backlogCovers(
      queryClient.getQueryData<CarouselPools>(queryKeys.carousels.byUser(user.id)),
      new Set(queue.map((q) => q.game_id)),
    );
  });

  const handlePick = () => {
    if (suggestion) {
      onPick(suggestion.game);
      onClose();
    }
  };

  // For the queue, instead of answering the questions: a random backlog game,
  // rolled for like Home's Random, then yours to add or roll again.
  const [chance, setChance] = useState<Chance | null>(null);
  const [rolls, setRolls] = useState(0);
  const leaveToChance = async () => {
    if (!user) return;
    setChance({ phase: 'rolling' });
    setRolls((n) => n + 1);
    const rolling = covers.length >= 2 && !prefersReducedMotion();
    const [found] = await Promise.all([
      findRandomBacklogGame(createClient(), user.id),
      rolling ? new Promise((resolve) => setTimeout(resolve, RANDOM_ROLL_MS)) : null,
    ]);
    setChance(
      'game' in found
        ? { phase: 'result', game: found.game, roll: rolls + 1 }
        : {
            phase: 'error',
            message:
              found.error === 'none'
                ? "There's no backlog game left to pick: the ones that fit are already queued or started."
                : "Couldn't pick a random game. Try again.",
          },
    );
  };

  const isWizardStep = step === 'mood' || step === 'energy' || step === 'time';

  // Rendered only while open (see the home page), so each opening starts from
  // a fresh wizard and a late response can't land in a closed modal.
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" ariaLabel="Pick your next game">
      {chance?.phase === 'rolling' && <SuggestionLoading covers={covers} roll />}

      {chance?.phase === 'error' && (
        <SuggestionError
          error={chance.message}
          onRetry={leaveToChance}
          onStartOver={() => setChance(null)}
        />
      )}

      {chance?.phase === 'result' && (
        <SuggestionResult
          // Another roll's game comes into focus like the first, even the same one.
          key={chance.roll}
          suggestion={{ game: chance.game, reasoning: '' }}
          onPick={() => {
            onPick(chance.game);
            onClose();
          }}
          onReroll={leaveToChance}
          cooldownRemaining={0}
          isLoading={false}
          mode={mode}
          random
        />
      )}

      {!chance && isWizardStep && (
        <SuggestionWizard
          step={step}
          onSelectMood={selectMood}
          onSelectEnergy={selectEnergy}
          onSelectTime={selectTime}
          onBack={goBack}
          showHistoryWarning={showHistoryWarning}
          onLeaveToChance={mode === 'queue' ? leaveToChance : undefined}
        />
      )}

      {!chance && step === 'loading' && <SuggestionLoading covers={covers} />}

      {!chance && step === 'result' && error && (
        <SuggestionError error={error} onRetry={retry} onStartOver={reset} />
      )}

      {!chance && step === 'result' && suggestion && !error && (
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
