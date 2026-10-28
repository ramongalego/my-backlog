import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

const TONE = {
  neutral: 'text-ink-400',
  success: 'text-emerald-400',
  error: 'text-rose-400',
};

/**
 * Where an auth form ends up: "Check your email", "Password updated", a bad
 * link. The icon stands alone in its meaning's colour, not on a tinted disc.
 */
export function AuthMessage({
  icon: Icon,
  tone = 'neutral',
  title,
  children,
}: {
  icon: LucideIcon;
  tone?: keyof typeof TONE;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center text-center gap-3 py-4">
      <Icon className={`w-8 h-8 ${TONE[tone]}`} aria-hidden="true" />
      <p className="text-ink-100 font-medium">{title}</p>
      {children && <p className="text-sm text-ink-400">{children}</p>}
    </div>
  );
}
