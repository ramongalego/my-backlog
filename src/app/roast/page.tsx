'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Flame, Loader2, Gamepad2, ExternalLink } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/Button';

interface RoastResult {
  roast: string;
  profile: {
    name: string;
    avatar: string;
    profileUrl: string;
  };
  stats: {
    totalGames: number;
    totalHours: number;
    neverPlayed: number;
  };
}

export default function RoastPage() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<RoastResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/roast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steamInput: input.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
      } else {
        setResult(data);
      }
    } catch {
      setError('Failed to connect. Please try again.');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Header />

      <main className="pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-orange-500/10 rounded-2xl mb-4">
              <Flame className="w-7 h-7 text-orange-400" />
            </div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">Roast My Steam</h1>
            <p className="text-zinc-400">
              Paste your Steam profile link and let AI destroy your gaming dignity.
            </p>
          </div>

          {/* Input form */}
          <form onSubmit={handleSubmit} className="mb-10">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://steamcommunity.com/id/username"
                aria-label="Steam profile URL or username"
                className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Roasting...
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 mr-2" />
                    Roast
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-zinc-600 mt-2">
              Paste the full Steam profile URL for best results. Game library must be public.
            </p>
          </form>

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm mb-8">
              {error}
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="text-center py-16">
              <div className="relative inline-block">
                <div className="w-16 h-16 border-4 border-zinc-700 border-t-orange-400 rounded-full animate-spin" />
                <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 text-orange-400" />
              </div>
              <p className="mt-6 text-zinc-400">Analyzing your shameful library...</p>
            </div>
          )}

          {/* Result */}
          {result && !isLoading && (
            <div className="space-y-6">
              {/* Profile card */}
              <div className="flex items-center gap-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
                <Image
                  src={result.profile.avatar}
                  alt={result.profile.name}
                  width={56}
                  height={56}
                  className="rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <a
                    href={result.profile.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex items-center gap-1.5 text-lg font-semibold text-zinc-100 hover:text-white transition-colors"
                  >
                    {result.profile.name}
                    <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <div className="flex gap-4 text-sm text-zinc-500 mt-0.5">
                    <span className="flex items-center gap-1">
                      <Gamepad2 className="w-3.5 h-3.5" />
                      {result.stats.totalGames} games
                    </span>
                    <span>{result.stats.totalHours.toLocaleString()}h played</span>
                    <span>{result.stats.neverPlayed} never launched</span>
                  </div>
                </div>
              </div>

              {/* The roast */}
              <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-orange-400 uppercase tracking-widest font-medium">
                    The Roast
                  </span>
                </div>
                <div className="text-zinc-300 leading-relaxed whitespace-pre-line">
                  {result.roast}
                </div>
              </div>

              {/* Roast again */}
              <div className="text-center">
                <button
                  onClick={() => {
                    setResult(null);
                    setInput('');
                  }}
                  className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                >
                  Roast someone else
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
