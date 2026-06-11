'use client';

import { type ButtonHTMLAttributes, type Ref } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({
  className = '',
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  children,
  ref,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';

  const variants = {
    primary: 'bg-violet-600 text-white hover:bg-violet-700 focus:ring-violet-500',
    secondary: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus:ring-zinc-500',
    ghost: 'bg-transparent text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 focus:ring-zinc-500',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 focus:ring-emerald-500',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 focus:ring-rose-500',
  };

  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  };

  return (
    <button
      ref={ref}
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {/* Keep the label visible while loading so the button doesn't change
          width and the user still sees what action is in flight. */}
      {isLoading && <Loader2 className="animate-spin h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}
