'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Gamepad2,
  Trophy,
  TrendingUp,
  TrendingDown,
  Check,
  Star,
  ChevronRight,
  Share2,
  Link2,
  Loader2,
} from 'lucide-react';
import { Modal } from '@/components/ui/Modal';

export interface GameSummaryData {
  gameName: string;
  headerImage: string | null;
  playtimeMinutes: number;
  mainStoryHours: number | null;
  rating: number | null;
  gamesFinished: number;
  totalGames: number;
  backlogHoursRemoved: number | null;
  nextGame: string | null;
}

interface GameSummaryModalProps extends GameSummaryData {
  isOpen: boolean;
  onClose: () => void;
}

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

export function GameSummaryModal({
  isOpen,
  onClose,
  gameName,
  headerImage,
  playtimeMinutes,
  mainStoryHours,
  rating,
  gamesFinished,
  totalGames,
  backlogHoursRemoved,
  nextGame,
}: GameSummaryModalProps) {
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'shared'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const steamHours = Math.round((playtimeMinutes / 60) * 10) / 10;

  type EstimateInfo = {
    icon: React.ReactNode;
    value: string;
    middle: string;
    pct: string | null;
  };
  let estimate: EstimateInfo | null = null;
  if (mainStoryHours && mainStoryHours > 0 && steamHours > 0) {
    const diff = steamHours - mainStoryHours;
    const absDiff = Math.round(Math.abs(diff) * 10) / 10;
    const pct = Math.abs(Math.round((diff / mainStoryHours) * 100));
    if (absDiff < 0.5) {
      estimate = {
        icon: <Check className="w-4 h-4 shrink-0 text-emerald-400" />,
        value: 'Right on',
        middle: `the ~${mainStoryHours}h estimate`,
        pct: null,
      };
    } else if (diff > 0) {
      estimate = {
        icon: <TrendingUp className="w-4 h-4 shrink-0 text-amber-400" />,
        value: `${absDiff}h`,
        middle: `over the ~${mainStoryHours}h estimate`,
        pct: `(+${pct}%)`,
      };
    } else {
      estimate = {
        icon: <TrendingDown className="w-4 h-4 shrink-0 text-emerald-400" />,
        value: `${absDiff}h`,
        middle: `under the ~${mainStoryHours}h estimate`,
        pct: `(−${pct}%)`,
      };
    }
  }

  const handleShare = async () => {
    if (shareState === 'loading') return;

    // If already shared, just reuse the URL
    if (shareUrl) {
      setShareState('shared');
      return;
    }

    setShareState('loading');

    try {
      const res = await fetch('/api/share/completion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameName,
          headerImage,
          playtimeMinutes,
          mainStoryHours,
          rating,
          gamesFinished,
          totalGames,
          backlogHoursRemoved,
          nextGame,
        }),
      });

      if (!res.ok) throw new Error('Failed to share');

      const data = await res.json();
      const fullUrl = `${window.location.origin}${data.url}`;
      setShareUrl(fullUrl);
      setShareState('shared');
    } catch {
      setShareState('idle');
    }
  };

  const shareText = [
    `Just finished ${gameName}!`,
    steamHours > 0 ? `${steamHours}h played` : null,
    rating !== null ? `Rated ${rating}/10` : null,
  ]
    .filter(Boolean)
    .join(' - ');

  const handleCopyLink = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl!)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleReddit = () => {
    const url = `https://www.reddit.com/submit?title=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl!)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      {/* Hero */}
      <div className="relative -mx-6 -mt-6 h-44 overflow-hidden rounded-t-2xl">
        {headerImage ? (
          <Image
            src={headerImage}
            alt={gameName}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 512px"
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <Gamepad2 className="w-10 h-10 text-zinc-600" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/40 to-transparent" />
        <h2 className="absolute bottom-3 left-6 right-12 text-xl font-bold text-white leading-tight line-clamp-2">
          {gameName}
        </h2>
      </div>

      <div className="space-y-5 mt-5 -mb-2">
        {/* Tagline */}
        <div className="flex items-center gap-2 text-sm">
          <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
          <p className="text-zinc-400 uppercase tracking-wider font-medium">You finished it!</p>
        </div>

        {/* Playtime + estimate */}
        {steamHours > 0 && (
          <div data-testid="estimate-text" className="flex items-center gap-2 text-sm">
            {estimate ? estimate.icon : null}
            <span className="flex items-center gap-1 flex-wrap">
              <span className="font-semibold text-zinc-100">{steamHours}h of playtime</span>
              {estimate && (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-400">
                    {estimate.value === 'Right on'
                      ? 'right on'
                      : `${estimate.value} ${estimate.middle}`}
                  </span>
                  {estimate.pct && (
                    <span className="font-semibold text-zinc-100">{estimate.pct}</span>
                  )}
                </>
              )}
            </span>
          </div>
        )}

        {/* Rating */}
        {rating !== null && (
          <div className="flex items-center gap-2 text-sm">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-400">You rated it</span>
              <span className="text-zinc-100 font-semibold">{rating}</span>
              <span className="text-zinc-500">/ 10</span>
            </span>
          </div>
        )}

        {/* Impact stats */}
        {(totalGames > 0 || backlogHoursRemoved) && (
          <div className="flex divide-x divide-zinc-800 py-3">
            {totalGames > 0 && (
              <div className={`text-center ${backlogHoursRemoved ? 'flex-1 pr-3' : 'w-full'}`}>
                <p className="text-2xl font-bold text-zinc-100">
                  {gamesFinished}/{totalGames}
                </p>
                <p className="text-xs text-zinc-500 mt-1">games finished</p>
              </div>
            )}
            {backlogHoursRemoved && (
              <div className={`text-center ${totalGames > 0 ? 'flex-1 pl-3' : 'w-full'}`}>
                <p className="text-2xl font-bold text-emerald-400">-{backlogHoursRemoved}h</p>
                <p className="text-xs text-zinc-500 mt-1">from backlog</p>
              </div>
            )}
          </div>
        )}

        {/* Next up */}
        {nextGame && (
          <div className="flex items-center gap-2 text-sm">
            <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
            <span className="text-zinc-400">Next up:</span>
            <span className="font-semibold text-zinc-100 truncate pr-1">{nextGame}</span>
          </div>
        )}

        {/* Share section */}
        <div className="pt-4 border-t border-zinc-800">
          {shareState === 'idle' && (
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer w-full"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          )}

          {shareState === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating share link...
            </div>
          )}

          {shareState === 'shared' && shareUrl && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleReddit}
                aria-label="Share on Reddit"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-sm cursor-pointer"
              >
                <RedditIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Reddit
              </button>
              <button
                onClick={handleTwitter}
                aria-label="Share on Twitter"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-sm cursor-pointer"
              >
                <TwitterIcon className="w-3.5 h-3.5" aria-hidden="true" />
                Twitter
              </button>
              <button
                onClick={handleCopyLink}
                aria-label="Copy share link"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-sm cursor-pointer"
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
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
