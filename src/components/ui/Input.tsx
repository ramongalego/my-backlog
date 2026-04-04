'use client';

import { type InputHTMLAttributes, type Ref } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className = '', label, error, id, ref, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-zinc-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={`
            w-full px-4 py-2.5 bg-zinc-800 border rounded-lg text-zinc-100
            placeholder:text-zinc-500 transition-colors
            focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent
            ${error ? 'border-red-500' : 'border-zinc-700 hover:border-zinc-600'}
            ${className}
          `}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-sm text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
