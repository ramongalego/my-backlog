import { answeredOptions } from '@/lib/suggest/questions';
import type { SuggestionPreferences } from '@/lib/suggest/types';

/** Your three answers with their icons: what the game is being picked for. */
export function AnswerLine({
  answers,
  className = '',
}: {
  answers: Partial<SuggestionPreferences>;
  className?: string;
}) {
  const options = answeredOptions(answers);
  if (options.length === 0) return null;
  return (
    <ul
      aria-label="Your answers"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-400 ${className}`}
    >
      {options.map((option) => (
        <li key={String(option.value)} className="flex items-center gap-1.5">
          <option.icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{option.short ?? option.label}</span>
        </li>
      ))}
    </ul>
  );
}
