'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SectionLabel } from '@/components/layout/Page';
import { Skeleton } from '@/components/layout/Skeleton';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { fetchInsight } from '@/lib/client/insights';
import { queries } from '@/lib/data/queries';
import type { InsightTone } from '@/lib/profile/prompt';
import { writtenOn, type SavedInsights } from '@/lib/profile/saved';
import { queryKeys } from '@/lib/query-keys';

const TONES = [
  { value: 'profile', label: 'Profile' },
  { value: 'roast', label: 'Roast' },
] as const;

const COPY: Record<InsightTone, { offer: string; action: string; writing: string }> = {
  profile: {
    offer:
      'What you finish, what you drop, what you rate highly: what it all says about you as a player',
    action: 'Read my profile',
    writing: 'Reading your library…',
  },
  roast: {
    offer: 'The same library, with none of the kindness',
    action: 'Roast me',
    writing: 'Sharpening the knives…',
  },
};

type PerTone<T> = Partial<Record<InsightTone, T>>;

/**
 * Shows the saved profile and roast as Stats loads, and writes one only when
 * asked: the first time, or with Rewrite once the library has changed since
 * (`signature` is the library's now, from useStatsPage). Stats shows it only
 * once hasEnoughForProfile.
 */
export function PlayerProfile({ userId, signature }: { userId: string; signature: string }) {
  const [tone, setTone] = useState<InsightTone>('profile');
  const queryClient = useQueryClient();
  const { data: saved, isPending: loadingSaved } = useQuery(queries.savedInsights(userId));
  const [failed, setFailed] = useState<PerTone<string>>({});
  // The server answered with the old one: past the day's limit, or the model failed.
  const [notRewritten, setNotRewritten] = useState<PerTone<boolean>>({});
  const sending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  // A new one replaces the button that asked for it, so focus moves to it.
  const focusWhenWritten = useRef(false);

  const write = useMutation({
    mutationFn: (asked: InsightTone) => fetchInsight(asked),
    onSuccess: (insight, written) => {
      focusWhenWritten.current = written === tone && insight.signature === signature;
      queryClient.setQueryData<SavedInsights>(queryKeys.insights(userId), (prev) => ({
        ...(prev ?? { profile: null, roast: null }),
        [written]: insight,
      }));
      setNotRewritten((prev) => ({ ...prev, [written]: insight.signature !== signature }));
    },
    onError: (err, written) => setFailed((prev) => ({ ...prev, [written]: err.message })),
    onSettled: () => {
      sending.current = false;
    },
  });

  const ask = (asked: InsightTone) => {
    if (sending.current) return;
    sending.current = true;
    setFailed((prev) => ({ ...prev, [asked]: undefined }));
    setNotRewritten((prev) => ({ ...prev, [asked]: false }));
    write.mutate(asked);
  };

  const current = saved?.[tone] ?? null;
  const outOfDate = !!current && current.signature !== signature;
  const writing = write.isPending && write.variables === tone;
  const copy = COPY[tone];

  useEffect(() => {
    if (current && focusWhenWritten.current) {
      focusWhenWritten.current = false;
      heading.current?.focus();
    }
  }, [current]);

  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <SectionLabel>What your library says about you</SectionLabel>
        <ToggleGroup
          variant="segmented"
          label="Profile or roast"
          value={tone}
          onChange={setTone}
          options={TONES}
        />
      </div>

      {loadingSaved ? (
        <div aria-busy="true">
          <Skeleton className="h-6 w-2/3 mb-5" />
          <div className="space-y-2.5 max-w-2xl">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ) : current ? (
        <article className="max-w-2xl animate-result-in motion-reduce:animate-none" key={tone}>
          <h3
            ref={heading}
            tabIndex={-1}
            className="text-xl sm:text-2xl font-semibold tracking-tight text-ink-50 text-balance outline-none"
          >
            {current.headline}
          </h3>
          <div className="mt-4 space-y-3 text-ink-300 leading-relaxed">
            {current.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="text-sm text-ink-400">
              {outOfDate
                ? `Written ${writtenOn(current.generatedAt)}. Your library has changed since.`
                : `Written ${writtenOn(current.generatedAt)}`}
            </p>
            {outOfDate && (
              <Button
                variant="secondary"
                size="sm"
                className="cursor-pointer whitespace-nowrap"
                onClick={() => ask(tone)}
                isLoading={writing}
              >
                Rewrite
              </Button>
            )}
          </div>
          <div aria-live="polite">
            {notRewritten[tone] && outOfDate && (
              <p className="mt-3 text-sm text-ink-300">
                Couldn’t write a new one right now. Try again later.
              </p>
            )}
          </div>
          {failed[tone] && (
            <p role="alert" className="mt-3 text-sm text-rose-400">
              {failed[tone]}
            </p>
          )}
        </article>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-ink-300" aria-live="polite">
              {writing ? copy.writing : copy.offer}
            </p>
            {failed[tone] && (
              <p role="alert" className="mt-2 text-sm text-rose-400">
                {failed[tone]}
              </p>
            )}
          </div>
          <Button
            variant="secondary"
            className="cursor-pointer self-start sm:self-auto shrink-0 whitespace-nowrap"
            onClick={() => ask(tone)}
            isLoading={writing}
          >
            {failed[tone] ? 'Try again' : copy.action}
          </Button>
        </div>
      )}
    </Panel>
  );
}
