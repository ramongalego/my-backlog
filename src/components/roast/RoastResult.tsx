'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Link2, Check } from 'lucide-react';
import type { RoastResponse } from '@/lib/roast/cache';

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function RedditIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
    </svg>
  );
}

interface RoastResultProps {
  result: RoastResponse;
  onRoastAnother?: () => void;
}

export function RoastResult({ result, onRoastAnother }: RoastResultProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/roast/${result.steamId}`;
  const shareText = `Check out this roast of ${result.profile.name}'s Steam profile`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReddit = () => {
    const url = `https://www.reddit.com/submit?title=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
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
      <div className="flex flex-col items-center gap-4">
        <div
          className="flex flex-col items-center gap-2"
          role="group"
          aria-labelledby="roast-share-heading"
        >
          <h2 id="roast-share-heading" className="text-xs uppercase tracking-wider text-zinc-600">
            Share
          </h2>
          <div className="flex items-center gap-4">
            <button
              onClick={handleReddit}
              aria-label="Share on Reddit"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <RedditIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Reddit</span>
            </button>
            <span className="text-zinc-700" aria-hidden="true">
              &middot;
            </span>
            <button
              onClick={handleTwitter}
              aria-label="Share on Twitter"
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              <TwitterIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Twitter</span>
            </button>
            <span className="text-zinc-700" aria-hidden="true">
              &middot;
            </span>
            <button
              onClick={handleCopyLink}
              aria-label="Copy share link"
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
                  <span>Copy link</span>
                </>
              )}
            </button>
          </div>
        </div>
        {onRoastAnother && (
          <button
            onClick={onRoastAnother}
            className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            Roast someone else
          </button>
        )}
      </div>
    </div>
  );
}
