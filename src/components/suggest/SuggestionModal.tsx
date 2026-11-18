'use client';

import { useEffect, useRef, useState } from 'react';
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
import type { PickOutcome, SuggestionResult as Suggestion } from '@/lib/suggest/types';
import type { QueueItem } from '@/types/games';
import { findRandomBacklogGame, RANDOM_ROLL_MS, type RandomGame } from '@/lib/client/random-pick';
import { recordPickOutcome, recordRandomPick } from '@/lib/client/picks';
import { prefersReducedMotion } from '@/lib/motion';

/** Leaving it to chance: rolling, then the game it landed on (or why it couldn't). */
type Chance =
  | { phase: 'rolling' }
  | {
      phase: 'result';
      game: RandomGame;
      roll: number;
      /** The pick as the server kept it: its id, or null when it couldn't be kept. */
      pickId: Promise<number | null>;
    }
  | { phase: 'error'; message: string };

interface SuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPick: (game: Suggestion['game']) => void;
  /** With a game playing (`queue` mode): play the picked game now instead. */
  onPlayNow?: (game: Suggestion['game']) => void;
  mode?: 'play' | 'queue';
  showHistoryWarning?: boolean;
}

export function SuggestionModal({
  isOpen,
  onClose,
  onPick,
  onPlayNow,
  mode = 'play',
  showHistoryWarning = false,
}: SuggestionModalProps) {
  const {
    step,
    answers,
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
  } = useSuggestion(mode);
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

  // A pick's outcome is kept once (game_picks), however many times its buttons
  // are pressed. `pick` is the suggestion or the game chance landed on.
  const answered = useRef(new WeakSet<object>());
  const answer = (
    pick: object,
    pickId: Promise<number | null> | number | null | undefined,
    outcome: PickOutcome,
  ) => {
    if (answered.current.has(pick)) return;
    answered.current.add(pick);
    void Promise.resolve(pickId).then((id) => recordPickOutcome(id, outcome));
  };
  const taken: PickOutcome = mode === 'queue' ? 'queued' : 'played';

  const handlePick = () => {
    if (suggestion) {
      answer(suggestion, suggestion.pickId, taken);
      onPick(suggestion.game);
      onClose();
    }
  };
  const offersPlayNow = mode === 'queue' && !!onPlayNow;
  const playNow = (
    pick: object,
    pickId: Promise<number | null> | number | null | undefined,
    game: Suggestion['game'],
  ) => {
    answer(pick, pickId, 'played');
    onPlayNow?.(game);
    onClose();
  };

  // For the queue, instead of the questions: a random backlog game, rolled like
  // Home's Random.
  const [chance, setChance] = useState<Chance | null>(null);
  const [rolls, setRolls] = useState(0);
  // Its buttons stay until the next redraw, so a second press before then
  // would roll, and keep, a second pick.
  const rolling = useRef(false);
  // Games landed on this opening, numbering each pick's attempt.
  const landed = useRef(0);
  // A roll that ends after the picker closed landed on a game nobody saw,
  // which is no pick.
  const open = useRef(true);
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
    };
  }, []);
  const leaveToChance = async () => {
    if (!user || rolling.current) return;
    rolling.current = true;
    try {
      await roll(user.id);
    } finally {
      rolling.current = false;
    }
  };
  const roll = async (userId: string) => {
    // Rolling again passes on the game it had landed on.
    if (chance?.phase === 'result') answer(chance, chance.pickId, 'rerolled');
    setChance({ phase: 'rolling' });
    setRolls((n) => n + 1);
    const animated = covers.length >= 2 && !prefersReducedMotion();
    const [found] = await Promise.all([
      findRandomBacklogGame(userId),
      animated ? new Promise((resolve) => setTimeout(resolve, RANDOM_ROLL_MS)) : null,
    ]);
    if (!open.current) return;
    setChance(
      'game' in found
        ? {
            phase: 'result',
            game: found.game,
            roll: rolls + 1,
            // Kept with the picks; not waited for to show the game.
            pickId: recordRandomPick({
              gameId: found.game.id,
              mode,
              attempt: (landed.current += 1),
            }),
          }
        : {
            phase: 'error',
            message:
              found.error === 'none'
                ? "There's no backlog game left to pick: the ones that fit are already queued or started"
                : "Couldn't pick a random game. Try again.",
          },
    );
  };

  const isWizardStep = step === 'mood' || step === 'energy' || step === 'time';

  // The pick, for screen readers: the answer tiles are gone by the time it
  // lands, so nothing has focus to read it from.
  const picked =
    chance?.phase === 'result'
      ? `Picked ${chance.game.name}.`
      : !chance && step === 'result' && suggestion && !error
        ? `Picked ${suggestion.game.name}. ${suggestion.reasoning}`
        : '';

  // Rendered only while open (see the home page), so each opening starts from
  // a fresh wizard and a late response can't land in a closed modal.
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      // Held at the top, so it grows downwards as the steps change height.
      align="top"
      ariaLabel="Pick your next game"
    >
      {/* Always here, so its text changing is what's announced. */}
      <p className="sr-only" aria-live="polite">
        {picked}
      </p>
      {chance?.phase === 'rolling' && (
        // The first roll comes straight from the questions; another from its game.
        <SuggestionLoading covers={covers} roll opening={rolls === 1} />
      )}

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
            // Rolling again already: this game has been passed on.
            if (rolling.current) return;
            answer(chance, chance.pickId, taken);
            onPick(chance.game);
            onClose();
          }}
          onPlayNow={
            offersPlayNow
              ? () => {
                  if (rolling.current) return;
                  playNow(chance, chance.pickId, chance.game);
                }
              : undefined
          }
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
          answers={answers}
          covers={covers}
          onSelectMood={selectMood}
          onSelectEnergy={selectEnergy}
          onSelectTime={selectTime}
          onBack={goBack}
          showHistoryWarning={showHistoryWarning}
          onLeaveToChance={mode === 'queue' ? leaveToChance : undefined}
        />
      )}

      {!chance && step === 'loading' && (
        // A reroll starts from its game's art; the first pick, from the questions.
        <SuggestionLoading covers={covers} answers={answers} opening={!suggestion} />
      )}

      {!chance && step === 'result' && error && (
        <SuggestionError error={error} onRetry={retry} onStartOver={reset} />
      )}

      {!chance && step === 'result' && suggestion && !error && (
        <SuggestionResult
          // A reroll's game comes into focus like the first.
          key={suggestion.game.id}
          suggestion={suggestion}
          onPick={handlePick}
          onPlayNow={
            offersPlayNow
              ? () => playNow(suggestion, suggestion.pickId, suggestion.game)
              : undefined
          }
          onReroll={reroll}
          cooldownRemaining={cooldownRemaining}
          isLoading={isLoading}
          mode={mode}
          answers={answers}
        />
      )}
    </Modal>
  );
}
