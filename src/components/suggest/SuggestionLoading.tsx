import { Sparkles } from 'lucide-react';

export function SuggestionLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-ink-700 border-t-ink-300 rounded-full animate-spin" />
        <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-accent-400" />
      </div>
      <p className="mt-6 text-ink-400 text-center">Picking a game from your backlog…</p>
    </div>
  );
}
