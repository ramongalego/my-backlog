'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { Flame, Loader2, ShieldOff, X } from 'lucide-react';
import { RoastHeader, RoastShell } from '@/components/roast/RoastLayout';

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

      // A gateway timeout returns HTML, not JSON.
      const data = await res.json().catch(() => ({}));

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
      queryClient.setQueryData(queryKeys.roast.byId(data.steamId), data);
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
    <RoastShell>
      <RoastHeader tagline="Enter a Steam Profile and get a savage roast of their gaming habits" />

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
              className="w-full h-12 px-4 pr-10 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/20 transition-colors"
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
          <Button
            type="submit"
            size="lg"
            className="!rounded-xl shrink-0"
            disabled={roastMutation.isPending || !input.trim()}
          >
            {roastMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Roasting...
              </>
            ) : (
              <>
                <Flame className="w-4 h-4" />
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
    </RoastShell>
  );
}
