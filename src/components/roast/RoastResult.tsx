'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link2, Check } from 'lucide-react';
import type { RoastResponse } from '@/lib/roast/cache';

interface RoastResultProps {
  result: RoastResponse;
  onRoastAnother?: () => void;
}

export function RoastResult({ result, onRoastAnother }: RoastResultProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/roast/${result.steamId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Profile strip */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Image
          src={result.profile.avatar}
          alt={result.profile.name}
          width={36}
          height={36}
          className="rounded-md"
        />
        <a
          href={result.profile.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {result.profile.name}
        </a>
        <span className="text-zinc-700">&middot;</span>
        <span>{result.stats.totalGames} games</span>
        <span className="text-zinc-700">&middot;</span>
        <span>{result.stats.totalHours.toLocaleString()}h played</span>
        <span className="text-zinc-700">&middot;</span>
        <span>{result.stats.neverPlayed} never launched</span>
      </div>

      {/* The roast */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
        <div className="text-zinc-300 leading-relaxed whitespace-pre-line">{result.roast}</div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5" />
              Copy link
            </>
          )}
        </button>
        {onRoastAnother && (
          <>
            <span className="text-zinc-700">&middot;</span>
            <button
              onClick={onRoastAnother}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              Roast someone else
            </button>
          </>
        )}
      </div>
    </div>
  );
}
