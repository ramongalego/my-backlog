'use client';

import { useState, useRef, useEffect } from 'react';
import type {
  SuggestionPreferences,
  SuggestionResult,
  MoodType,
  EnergyLevel,
  TimeCommitment,
  PickMode,
} from '@/lib/suggest/types';
import { MAX_PREVIOUS_REASONINGS } from '@/lib/validations/suggest';
import { recordPickOutcome } from '@/lib/client/picks';

type WizardStep = 'mood' | 'energy' | 'time' | 'loading' | 'result';

interface UseSuggestionReturn {
  // Wizard state
  step: WizardStep;
  answers: Partial<SuggestionPreferences>;

  // Result state
  suggestion: SuggestionResult | null;
  error: string | null;

  // Cooldown state
  cooldownRemaining: number;
  isOnCooldown: boolean;

  // Actions
  selectMood: (mood: MoodType) => void;
  selectEnergy: (energy: EnergyLevel) => void;
  selectTime: (time: TimeCommitment) => void;
  goBack: () => void;
  reroll: () => Promise<void>;
  retry: () => void;
  reset: () => void;

  // Loading state
  isLoading: boolean;
}

const COOLDOWN_SECONDS = 15;

/** `mode`: what the pick is for (to play, or for the queue), kept with each pick. */
export function useSuggestion(mode: PickMode = 'play'): UseSuggestionReturn {
  const [step, setStep] = useState<WizardStep>('mood');
  const [answers, setAnswers] = useState<Partial<SuggestionPreferences>>({});
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Track excluded games and previous reasonings (for rerolls within the same session)
  const excludedGameIdsRef = useRef<number[]>([]);
  const previousReasoningsRef = useRef<string[]>([]);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  // A pick on its way. Each one is a call to the AI and counts toward the
  // day's picks, so an answer, Reroll or Try again pressed twice asks once.
  const asking = useRef(false);

  // Whether the picker is still open. A pick that arrives after it closed
  // was never shown.
  const open = useRef(true);

  // Cleanup cooldown interval on unmount
  useEffect(() => {
    open.current = true;
    return () => {
      open.current = false;
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  const startCooldown = () => {
    setCooldownRemaining(COOLDOWN_SECONDS);

    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownIntervalRef.current) {
            clearInterval(cooldownIntervalRef.current);
            cooldownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const fetchSuggestion = async (preferences: SuggestionPreferences) => {
    if (asking.current) return;
    asking.current = true;
    setIsLoading(true);
    setError(null);
    setStep('loading');

    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...preferences,
          mode,
          excludeGameIds: excludedGameIdsRef.current,
          // The latest few: the server takes no more, and refused the
          // request once a sitting had seen more picks than that.
          previousReasonings: previousReasoningsRef.current.slice(-MAX_PREVIOUS_REASONINGS),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get suggestion');
      }

      // The server kept the pick as it made it; the picker closed while it
      // was on its way, so it's kept as never seen.
      if (!open.current) {
        recordPickOutcome(data.data?.pickId, 'unseen');
        return;
      }

      // Track this reasoning for future rerolls
      if (data.data?.reasoning) {
        previousReasoningsRef.current = [...previousReasoningsRef.current, data.data.reasoning];
      }

      setSuggestion(data.data);
      setStep('result');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('result');
    } finally {
      asking.current = false;
      setIsLoading(false);
    }
  };

  const selectMood = (mood: MoodType) => {
    setAnswers((prev) => ({ ...prev, mood }));
    setStep('energy');
  };

  const selectEnergy = (energy: EnergyLevel) => {
    setAnswers((prev) => ({ ...prev, energy }));
    setStep('time');
  };

  const selectTime = (time: TimeCommitment) => {
    const newAnswers = { ...answers, time };
    setAnswers(newAnswers);

    // All answers collected, fetch suggestion
    if (newAnswers.mood && newAnswers.energy && newAnswers.time) {
      fetchSuggestion(newAnswers as SuggestionPreferences);
    }
  };

  const goBack = () => {
    if (step === 'energy') {
      setStep('mood');
    } else if (step === 'time') {
      setStep('energy');
    }
  };

  const reroll = async () => {
    if (
      asking.current ||
      cooldownRemaining > 0 ||
      !suggestion ||
      !answers.mood ||
      !answers.energy ||
      !answers.time
    ) {
      return;
    }

    // Add current suggestion to exclusion list
    excludedGameIdsRef.current = [...excludedGameIdsRef.current, suggestion.game.id];

    // Increment reroll count in background (fire and forget). With the pick's
    // id, when the server kept it, so the pick is kept as passed on.
    fetch('/api/suggest/reroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        gameId: suggestion.game.id,
        ...(suggestion.pickId != null ? { pickId: suggestion.pickId } : {}),
      }),
    }).catch(() => {
      // Ignore errors - this is non-critical
    });

    // Start cooldown
    startCooldown();

    // Fetch new suggestion
    await fetchSuggestion(answers as SuggestionPreferences);
  };

  // Asks again with the same answers, e.g. after a failed request.
  const retry = () => {
    if (isLoading || !answers.mood || !answers.energy || !answers.time) return;
    fetchSuggestion(answers as SuggestionPreferences);
  };

  const reset = () => {
    setStep('mood');
    setAnswers({});
    setSuggestion(null);
    setError(null);
    setIsLoading(false);
    setCooldownRemaining(0);
    asking.current = false;
    excludedGameIdsRef.current = [];
    previousReasoningsRef.current = [];

    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  };

  return {
    step,
    answers,
    suggestion,
    error,
    cooldownRemaining,
    isOnCooldown: cooldownRemaining > 0,
    selectMood,
    selectEnergy,
    selectTime,
    goBack,
    reroll,
    retry,
    reset,
    isLoading,
  };
}
