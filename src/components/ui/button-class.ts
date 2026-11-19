// No 'use client': a link drawn as a button (a server component's too) takes
// the same classes as Button itself.

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'success' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

// Keyboard focus uses the global :focus-visible outline, so clicks don't leave a ring.
const BASE =
  'inline-flex items-center justify-center gap-1.5 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-lg';

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

/** Button's look, for anything drawn as one. */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  isLoading = false,
}: { variant?: ButtonVariant; size?: ButtonSize; isLoading?: boolean } = {}): string {
  const variants: Record<ButtonVariant, string> = {
    // A faded accent reads as muddy brown, so a disabled (not loading) primary goes neutral.
    // (Each class stands apart from the ${}: Tailwind only finds whole words.)
    primary: `bg-accent-500 text-ink-950 hover:bg-accent-400 ${isLoading ? '' : 'disabled:bg-ink-800 disabled:text-ink-500 disabled:opacity-100'}`,
    secondary: 'bg-ink-800 text-ink-100 hover:bg-ink-700',
    ghost: 'bg-transparent text-ink-300 hover:bg-ink-800 hover:text-ink-100',
    success: 'bg-emerald-500 text-ink-950 hover:bg-emerald-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-500',
  };
  return `${BASE} ${variants[variant]} ${SIZES[size]}`;
}
