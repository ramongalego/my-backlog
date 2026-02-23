'use client';

import { memo } from 'react';
import type { QuestionOption } from '@/lib/suggest/questions';

interface QuestionStepProps<T> {
  title: string;
  options: QuestionOption<T>[];
  onSelect: (value: T) => void;
}

function QuestionStepInner<T>({ title, options, onSelect }: QuestionStepProps<T>) {
  return (
    <div className="flex flex-col items-center">
      <h2 className="text-xl sm:text-2xl font-semibold text-zinc-100 text-center mb-8">{title}</h2>

      <div className="grid gap-3 w-full max-w-md">
        {options.map((option) => (
          <button
            key={String(option.value)}
            onClick={() => onSelect(option.value)}
            className="group flex items-center gap-4 p-4 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-600 rounded-xl transition-all cursor-pointer text-left"
          >
            <option.icon className={`w-5 h-5 shrink-0 transition-colors ${option.iconClassName}`} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-zinc-100 group-hover:text-white transition-colors">
                {option.label}
              </p>
              <p className="text-sm text-zinc-500 group-hover:text-zinc-400 transition-colors">
                {option.description}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export const QuestionStep = memo(QuestionStepInner) as typeof QuestionStepInner;
