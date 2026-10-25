'use client';

import { type InputHTMLAttributes, type Ref } from 'react';

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
        <label htmlFor={inputId} className="block text-sm font-medium text-ink-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        className={`
            w-full px-4 py-2.5 bg-ink-800 border rounded-lg text-ink-100
            placeholder:text-ink-500 transition-colors
            focus:outline-none focus:ring-2 focus:ring-accent-500 focus:border-transparent
            ${error ? 'border-rose-500' : 'border-ink-700 hover:border-ink-600'}
            ${className}
          `}
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
