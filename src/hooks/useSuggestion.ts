'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  SuggestionPreferences,
  SuggestionResult,
  MoodType,
  EnergyLevel,
  TimeCommitment,
} from '@/lib/suggest/types';

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
  reset: () => void;

  // Loading state
  isLoading: boolean;
}

const COOLDOWN_SECONDS = 15;

export function useSuggestion(): UseSuggestionReturn {
  const [step, setStep] = useState<WizardStep>('mood');
  const [answers, setAnswers] = useState<Partial<SuggestionPreferences>>({});
  const [suggestion, setSuggestion] = useState<SuggestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  // Track excluded games and previous reasonings (for rerolls within the same session)
  const excludedAppIdsRef = useRef<number[]>([]);
  const previousReasoningsRef = useRef<string[]>([]);
  const cooldownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup cooldown interval on unmount
  useEffect(() => {
    return () => {
      if (cooldownIntervalRef.current) {
        clearInterval(cooldownIntervalRef.current);
      }
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldownRemaining(COOLDOWN_SECONDS);

    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
    }

    cooldownIntervalRef.current = setInterval(() => {
      setCooldownRemaining(prev => {
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
  }, []);

  const fetchSuggestion = useCallback(async (preferences: SuggestionPreferences) => {
    setIsLoading(true);
    setError(null);
    setStep('loading');

    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...preferences,
          excludeAppIds: excludedAppIdsRef.current,
          previousReasonings: previousReasoningsRef.current,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to get suggestion');
      }

      // Track this reasoning for future rerolls
      if (data.data?.reasoning) {
        previousReasoningsRef.current = [...previousReasoningsRef.current, data.data.reasoning];
      }

      setSuggestion(data.data);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setStep('result');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectMood = useCallback((mood: MoodType) => {
    setAnswers(prev => ({ ...prev, mood }));
    setStep('energy');
  }, []);

  const selectEnergy = useCallback((energy: EnergyLevel) => {
    setAnswers(prev => ({ ...prev, energy }));
    setStep('time');
  }, []);

  const selectTime = useCallback((time: TimeCommitment) => {
    const newAnswers = { ...answers, time };
    setAnswers(newAnswers);

    // All answers collected, fetch suggestion
    if (newAnswers.mood && newAnswers.energy && newAnswers.time) {
      fetchSuggestion(newAnswers as SuggestionPreferences);
    }
  }, [answers, fetchSuggestion]);

  const goBack = useCallback(() => {
    if (step === 'energy') {
      setStep('mood');
    } else if (step === 'time') {
      setStep('energy');
    }
  }, [step]);

  const reroll = useCallback(async () => {
    if (cooldownRemaining > 0 || !suggestion || !answers.mood || !answers.energy || !answers.time) {
      return;
    }

    // Add current suggestion to exclusion list
    excludedAppIdsRef.current = [...excludedAppIdsRef.current, suggestion.game.app_id];

    // Increment reroll count in background (fire and forget)
    fetch('/api/suggest/reroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: suggestion.game.app_id }),
    }).catch(() => {
      // Ignore errors - this is non-critical
    });

    // Start cooldown
    startCooldown();

    // Fetch new suggestion
    await fetchSuggestion(answers as SuggestionPreferences);
  }, [cooldownRemaining, suggestion, answers, fetchSuggestion, startCooldown]);

  const reset = useCallback(() => {
    setStep('mood');
    setAnswers({});
    setSuggestion(null);
    setError(null);
    setIsLoading(false);
    setCooldownRemaining(0);
    excludedAppIdsRef.current = [];
    previousReasoningsRef.current = [];

    if (cooldownIntervalRef.current) {
      clearInterval(cooldownIntervalRef.current);
      cooldownIntervalRef.current = null;
    }
  }, []);

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
    reset,
    isLoading,
  };
}
