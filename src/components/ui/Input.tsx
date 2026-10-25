'use client';

import { type InputHTMLAttributes, type Ref } from 'react';

/**
 * Shared look for every text field (inputs, textareas, search boxes). Add
 * padding and height at the call site. Focus brightens the border rather
 * than using the accent, which is reserved for actions.
 */
export function fieldClass(error?: boolean) {
  return `w-full bg-ink-800/60 border rounded-lg text-ink-100 placeholder:text-ink-500 transition-colors focus:outline-none ${
    error
      ? 'border-rose-500 focus:border-rose-400'
      : 'border-ink-700 hover:border-ink-600 focus:border-ink-400'
  }`;
}

/** Label for a form field, matching Input's built-in label. */
export const FIELD_LABEL = 'block text-sm font-medium text-ink-300 mb-1.5';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className = '', label, error, id, ref, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={FIELD_LABEL}>
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`${fieldClass(!!error)} px-4 py-2.5 ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-rose-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
