'use client';

import { useEffect, useRef, useState } from 'react';
import type { QuestionOption } from '@/lib/suggest/questions';
import { prefersReducedMotion } from '@/lib/motion';

// How long a chosen tile shows as chosen before the next question.
const CHOSEN_MS = 180;

interface QuestionStepProps<T> {
  options: QuestionOption<T>[];
  onSelect: (value: T) => void;
  /** The question's heading, which names the group of choices. */
  labelledBy: string;
}

/**
 * A question's answers as a grid of tiles: two across for four answers, three
 * for three (rows on phones). The number keys choose too. A chosen tile turns
 * light for a moment, so the choice registers before the next question.
 */
export function QuestionStep<T>({ options, onSelect, labelledBy }: QuestionStepProps<T>) {
  const [chosen, setChosen] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const choose = (value: T) => {
    if (chosen !== null) return;
    if (prefersReducedMotion()) return onSelect(value);
    setChosen(value);
    timer.current = setTimeout(() => onSelect(value), CHOSEN_MS);
  };

  // 1, 2, 3...: the answer with that number.
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.repeat) return;
      const option = options[Number(e.key) - 1];
      if (option) {
        e.preventDefault();
        chooseRef.current(option.value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options]);

  // Each question takes focus as it comes in (the last one's tiles are gone),
  // so its name is read out and Tab starts at its first answer.
  const group = useRef<HTMLDivElement>(null);
  useEffect(() => group.current?.focus({ preventScroll: true }), []);

  const wide = options.length === 4;
  return (
    <div
      ref={group}
      role="group"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      data-autofocus
      className={`grid gap-2.5 outline-none ${wide ? 'grid-cols-2' : 'sm:grid-cols-3'}`}
    >
      {options.map((option, i) => {
        const isChosen = chosen === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => choose(option.value)}
            // Answers settle in one after another, like search results.
            style={{ animationDelay: `${60 + i * 40}ms` }}
            className={`group relative flex gap-3 rounded-xl p-4 text-left transition-[background-color,opacity,scale] duration-150 cursor-pointer active:scale-[0.98] animate-result-in motion-reduce:animate-none ${
              wide ? 'flex-col' : 'items-center sm:flex-col sm:items-start'
            } ${
              isChosen
                ? 'bg-ink-100'
                : chosen !== null
                  ? 'bg-ink-800/60 opacity-40'
                  : 'bg-ink-800/60 hover:bg-ink-800'
            }`}
          >
            <option.icon
              className={`w-6 h-6 shrink-0 transition-colors ${
                isChosen ? 'text-ink-950' : 'text-ink-300 group-hover:text-accent-400'
              }`}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span
                className={`block font-semibold leading-snug ${isChosen ? 'text-ink-950' : 'text-ink-50'}`}
              >
                {option.label}
              </span>
              {option.hint && (
                <span
                  className={`block text-sm font-medium ${isChosen ? 'text-ink-800' : 'text-ink-300'}`}
                >
                  {option.hint}
                </span>
              )}
              <span
                className={`mt-1 block text-sm leading-snug ${isChosen ? 'text-ink-700' : 'text-ink-400'}`}
              >
                {option.description}
              </span>
            </span>
            {/* Its number key, where there's a keyboard. */}
            <kbd
              className={`absolute top-3 right-3 hidden min-w-5 rounded border px-1 text-center font-sans text-xs leading-5 [@media(pointer:fine)]:sm:block ${
                isChosen ? 'border-ink-400 text-ink-700' : 'border-ink-700 text-ink-500'
              }`}
              aria-hidden="true"
            >
              {i + 1}
            </kbd>
          </button>
        );
      })}
    </div>
  );
}
