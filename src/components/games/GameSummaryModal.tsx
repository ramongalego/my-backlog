'use client';

import { useState } from 'react';
import { Check, Share2, Link2, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { ArtHeader } from './ArtHeader';
import { CompletionSummary } from './CompletionSummary';

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
  /** When you started playing it, for how long it took. */
  startedAt?: string | null;
  /** The finish date chosen (YYYY-MM-DD). */
  finishedAt?: string | null;
  /** Games finished this year, counting this one. */
  finishedThisYear?: number | null;
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
  startedAt,
  finishedAt,
  finishedThisYear,
}: GameSummaryModalProps) {
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'shared'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const steamHours = Math.round((playtimeMinutes / 60) * 10) / 10;

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
    <Modal isOpen={isOpen} onClose={onClose} size="lg" ariaLabel={gameName}>
      <ArtHeader src={headerImage} title={gameName} />

      <div className="space-y-5 mt-5 -mb-2">
        <CompletionSummary
          playtimeMinutes={playtimeMinutes}
          mainStoryHours={mainStoryHours}
          rating={rating}
          gamesFinished={gamesFinished}
          totalGames={totalGames}
          backlogHoursRemoved={backlogHoursRemoved}
          nextGame={nextGame}
          startedAt={startedAt}
          finishedAt={finishedAt}
          finishedThisYear={finishedThisYear}
        />

        {/* Share section */}
        <div className="pt-4 border-t border-ink-800">
          {shareState === 'idle' && (
            <button
              onClick={handleShare}
              className="flex items-center justify-center gap-2 text-sm text-ink-500 hover:text-ink-300 transition-colors cursor-pointer w-full"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          )}

          {shareState === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-sm text-ink-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Creating share link...</span>
            </div>
          )}

          {shareState === 'shared' && shareUrl && (
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleReddit}
                aria-label="Share on Reddit"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-400 hover:text-ink-200 hover:bg-ink-700 transition-colors text-sm cursor-pointer"
              >
                <RedditIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Reddit</span>
              </button>
              <button
                onClick={handleTwitter}
                aria-label="Share on Twitter"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-400 hover:text-ink-200 hover:bg-ink-700 transition-colors text-sm cursor-pointer"
              >
                <TwitterIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Twitter</span>
              </button>
              <button
                onClick={handleCopyLink}
                aria-label="Copy share link"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-800 text-ink-400 hover:text-ink-200 hover:bg-ink-700 transition-colors text-sm cursor-pointer"
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
          )}
        </div>
      </div>
    </Modal>
  );
}
