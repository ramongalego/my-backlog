'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Flame, Loader2, ShieldOff, X } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { RoastResult } from '@/components/roast/RoastResult';
import type { RoastResponse } from '@/lib/roast/cache';

export default function RoastPage() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [blacklistMessage, setBlacklistMessage] = useState<string | null>(null);

  const roastMutation = useMutation({
    mutationFn: async (steamInput: string) => {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamInput }),
      });

      const data = await res.json();

      if (data.blacklisted) {
        throw { blacklisted: true, message: data.message };
      }
      if (!res.ok) {
        throw new Error(data.error ?? 'Something went wrong');
      }
      return data as RoastResponse;
    },
    onSuccess: (data) => {
      // Seed the shared roast page cache so /roast/[steamId] is instant
      queryClient.setQueryData(['roast', data.steamId], data);
    },
    onError: (err) => {
      if (typeof err === 'object' && err !== null && 'blacklisted' in err) {
        setBlacklistMessage((err as { message: string }).message);
      }
    },
    onMutate: () => {
      setBlacklistMessage(null);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || roastMutation.isPending) return;
    roastMutation.mutate(input.trim());
  };

  const error =
    roastMutation.error && !blacklistMessage
      ? roastMutation.error instanceof Error
        ? roastMutation.error.message
        : 'Failed to connect. Please try again.'
      : null;

  return (
    <div className="min-h-screen bg-zinc-950">
      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-violet-500/10 rounded-2xl mb-4">
              <Flame className="w-7 h-7 text-violet-400" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Steam Profile Roaster</h1>
            <p className="text-zinc-400">
              Enter a Steam Profile and get a savage roast of their gaming habits
            </p>
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="mb-10">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter Steam URL, Username, or Profile ID"
                  aria-label="Steam profile URL or username"
                  className="w-full px-4 py-3 pr-10 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                />
                {input && (
                  <button
                    type="button"
                    onClick={() => setInput('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                    aria-label="Clear input"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <Button type="submit" disabled={roastMutation.isPending || !input.trim()}>
                {roastMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    Roasting...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 mr-1.5" />
                    Roast
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              Paste the full Steam profile URL for best results. Steam profile must be public.
            </p>
          </form>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-8">
              {error}
            </div>
          )}

          {/* Blacklisted profile */}
          {blacklistMessage && (
            <div className="text-center py-16">
              <ShieldOff className="w-10 h-10 text-zinc-600 mx-auto mb-4" />
              <p className="text-lg text-zinc-300">{blacklistMessage}</p>
              <button
                onClick={() => {
                  setBlacklistMessage(null);
                  roastMutation.reset();
                  setInput('');
                }}
                className="mt-6 text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Roast someone else
              </button>
            </div>
          )}

          {/* Loading state */}
          {roastMutation.isPending && (
            <div className="text-center py-16">
              <div className="relative inline-block">
                <div className="w-16 h-16 border-4 border-zinc-700 border-t-violet-400 rounded-full animate-spin" />
                <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-violet-400" />
              </div>
              <p className="mt-6 text-zinc-400">Analyzing your shameful library...</p>
            </div>
          )}

          {/* Result */}
          {roastMutation.data && !roastMutation.isPending && (
            <RoastResult
              result={roastMutation.data}
              onRoastAnother={() => {
                roastMutation.reset();
                setInput('');
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}
