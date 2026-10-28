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
    // Keyboard focus uses the global :focus-visible outline, so clicks don't leave a ring.
    'inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';

  const variants = {
    // A faded accent reads as muddy brown, so a disabled (not loading) primary goes neutral.
    // (Each class stands apart from the ${}: Tailwind only finds whole words.)
    primary: `bg-accent-500 text-ink-950 hover:bg-accent-400 ${isLoading ? '' : 'disabled:bg-ink-800 disabled:text-ink-500 disabled:opacity-100'}`,
    secondary: 'bg-ink-800 text-ink-100 hover:bg-ink-700',
    ghost: 'bg-transparent text-ink-300 hover:bg-ink-800 hover:text-ink-100',
    success: 'bg-emerald-500 text-ink-950 hover:bg-emerald-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
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
