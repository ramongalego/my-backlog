'use client';

import type { QuestionOption } from '@/lib/suggest/questions';

interface QuestionStepProps<T> {
  title: string;
  options: QuestionOption<T>[];
  onSelect: (value: T) => void;
}

export function QuestionStep<T>({ title, options, onSelect }: QuestionStepProps<T>) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink-50 text-center mb-8">
        {title}
      </h2>

      <div className="grid gap-3 w-full max-w-md">
        {options.map((option) => (
          <button
            key={String(option.value)}
            onClick={() => onSelect(option.value)}
            className="group flex items-center gap-4 p-4 bg-ink-800/60 hover:bg-ink-800 rounded-xl transition-colors cursor-pointer text-left"
          >
            <option.icon className="w-5 h-5 shrink-0 text-ink-400 group-hover:text-accent-400 transition-colors" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-ink-100 group-hover:text-ink-50 transition-colors">
                {option.label}
              </p>
              <p className="text-sm text-ink-400">{option.description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
