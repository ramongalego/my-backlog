'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Share2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { createSharePage } from '@/lib/client/share';
import type { GameSummaryData } from '@/lib/games/completion';
import { ArtHeader } from './ArtHeader';
import { CompletionSummary } from './CompletionSummary';

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
  gameId,
  gameName,
  headerImage,
  playtimeMinutes,
  mainStoryHours,
  rating,
  gamesFinished,
  totalGames,
  nextGame,
  nextGameImage,
  startedAt,
  finishedAt,
  finishedThisYear,
}: GameSummaryModalProps) {
  const [shareState, setShareState] = useState<'idle' | 'loading' | 'shared'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyRef = useRef<HTMLButtonElement>(null);

  // Share is replaced by the places to share to: focus moves on to them,
  // rather than being lost with the button that was pressed.
  useEffect(() => {
    if (shareState === 'shared') copyRef.current?.focus();
  }, [shareState]);

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
      const url = await createSharePage(gameId);
      setShareUrl(`${window.location.origin}${url}`);
      setShareState('shared');
    } catch {
      setShareState('idle');
      toast.error("Couldn't create the share link. Try again.");
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
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      toast.error("Couldn't copy the link.");
      return;
    }
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
      {/* The art comes into focus, as it did when the game was picked. */}
      <ArtHeader
        src={headerImage}
        title={gameName}
        artClassName="animate-reveal motion-reduce:animate-overlay-in"
      />

      <div className="space-y-5 mt-5">
        <CompletionSummary
          playtimeMinutes={playtimeMinutes}
          mainStoryHours={mainStoryHours}
          rating={rating}
          gamesFinished={gamesFinished}
          totalGames={totalGames}
          nextGame={nextGame}
          nextGameImage={nextGameImage}
          startedAt={startedAt}
          finishedAt={finishedAt}
          finishedThisYear={finishedThisYear}
        />

        {/* Share section */}
        <div className="pt-5 border-t border-ink-800">
          <p role="status" className="sr-only">
            {copied ? 'Link copied' : shareState === 'shared' ? 'Share link ready' : ''}
          </p>
          {shareState === 'shared' && shareUrl ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={handleReddit}
                className="flex-auto px-2 whitespace-nowrap cursor-pointer"
              >
                <RedditIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Reddit</span>
                <span className="sr-only">(opens in a new tab)</span>
              </Button>
              <Button
                variant="secondary"
                onClick={handleTwitter}
                className="flex-auto px-2 whitespace-nowrap cursor-pointer"
              >
                <TwitterIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Twitter</span>
                <span className="sr-only">(opens in a new tab)</span>
              </Button>
              <Button
                ref={copyRef}
                variant="secondary"
                onClick={handleCopyLink}
                className="flex-auto px-2 whitespace-nowrap cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Copy link</span>
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={handleShare}
                isLoading={shareState === 'loading'}
                className="w-full cursor-pointer"
              >
                {shareState !== 'loading' && <Share2 className="w-4 h-4" aria-hidden="true" />}
                <span>Share</span>
              </Button>
              <p className="mt-2 text-center text-xs text-ink-500">
                Makes a public page with this summary.
              </p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
