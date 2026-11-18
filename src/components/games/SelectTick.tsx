import { Check } from 'lucide-react';

export function SelectTick({
  selected,
  className = '',
}: {
  selected: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 items-center justify-center rounded-full ${
        selected ? 'bg-ink-50 text-ink-950' : 'bg-ink-950/60 ring-[1.5px] ring-inset ring-ink-50/80'
      } ${className}`}
    >
      {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}
