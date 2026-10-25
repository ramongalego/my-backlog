'use client';

import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SuggestionErrorProps {
  error: string;
  onRetry: () => void;
}

export function SuggestionError({ error, onRetry }: SuggestionErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4">
        <AlertCircle className="w-8 h-8 text-rose-400" />
      </div>
      <p className="text-ink-300 text-center mb-2">Something went wrong</p>
      <p className="text-ink-500 text-sm text-center mb-6 max-w-xs">{error}</p>
      <Button onClick={onRetry} variant="secondary" className="cursor-pointer">
        Try Again
      </Button>
    </div>
  );
}
