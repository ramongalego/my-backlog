'use client';

import type { ReactNode } from 'react';

export interface ToggleOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Shown after the label in a quieter tone, e.g. how many items a filter matches. */
  count?: number;
}

/** A chip's classes, for chip rows that need more than ToggleGroup (e.g. a "More" chip). */
export function chipClass(selected: boolean) {
  return `shrink-0 flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
    selected
      ? 'bg-ink-100 text-ink-950'
      : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50'
  }`;
}

/**
 * Pick one of a few options. `chips` is for filters and choices that sit on
 * their own; `segmented` is for a small two- or three-way switch inside a
 * panel header (e.g. which data a chart shows).
 */
export function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  variant = 'chips',
  wrap = true,
  className = '',
}: {
  options: readonly ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  variant?: 'chips' | 'segmented';
  /** Chips only: wrap onto new lines, or scroll sideways in a single row. */
  wrap?: boolean;
  className?: string;
}) {
  const segmented = variant === 'segmented';
  const container = segmented
    ? 'inline-flex gap-0.5 rounded-lg bg-ink-800 p-0.5'
    : `flex gap-1.5 ${wrap ? 'flex-wrap' : 'overflow-x-auto scrollbar-none'}`;

  return (
    <div role="group" aria-label={label} className={`${container} ${className}`}>
      {options.map((option) => {
        const selected = option.value === value;
        const tone = segmented
          ? selected
            ? 'bg-ink-600 text-ink-50'
            : 'text-ink-400 hover:text-ink-100'
          : selected
            ? 'bg-ink-100 text-ink-950'
            : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50';
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={`shrink-0 flex items-center gap-2 font-medium cursor-pointer transition-colors ${
              segmented ? 'h-7 px-2.5 rounded-md text-xs' : 'h-8 px-3 rounded-lg text-sm'
            } ${tone}`}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`text-xs tabular-nums ${selected ? 'text-ink-600' : 'text-ink-400'}`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
