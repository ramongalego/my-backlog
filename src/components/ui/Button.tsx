'use client';

import { type ButtonHTMLAttributes, type Ref } from 'react';
import { Loader2 } from 'lucide-react';
import { buttonClass, type ButtonSize, type ButtonVariant } from './button-class';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
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
  return (
    <button
      ref={ref}
      className={`${buttonClass({ variant, size, isLoading })} ${className}`}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {/* The label stays while loading, so the width holds and the action stays in view. */}
      {isLoading && <Loader2 className="animate-spin h-4 w-4" aria-hidden="true" />}
      {children}
    </button>
  );
}
