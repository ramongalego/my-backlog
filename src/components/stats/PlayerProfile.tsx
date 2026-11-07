'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SectionLabel } from '@/components/layout/Page';
import { Skeleton } from '@/components/layout/Skeleton';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { fetchInsight } from '@/lib/client/insights';
import type { InsightTone } from '@/lib/profile/prompt';
import { queryKeys } from '@/lib/query-keys';

const TONES = [
  { value: 'profile', label: 'Profile' },
  { value: 'roast', label: 'Roast' },
] as const;

const COPY: Record<InsightTone, { offer: string; action: string; writing: string }> = {
  profile: {
    offer:
      'What you finish, what you drop, what you rate highly: what it all says about you as a player.',
    action: 'Read my profile',
    writing: 'Reading your library…',
  },
  roast: {
    offer: 'The same library, with none of the kindness.',
    action: 'Roast me',
    writing: 'Sharpening the knives…',
  },
};

/**
 * What your library says about you: a written player profile, or the same
 * facts as a roast. Stats only shows it once the library says enough
 * (hasEnoughForProfile), and each tone is only fetched when the player asks
 * for it.
 */
export function PlayerProfile({ userId }: { userId: string }) {
  const [tone, setTone] = useState<InsightTone>('profile');
  const [asked, setAsked] = useState<Record<InsightTone, boolean>>({
    profile: false,
    roast: false,
  });
  const { data, isError, error, refetch, isRefetching } = useQuery({
    queryKey: queryKeys.games.insight(userId, tone),
    queryFn: () => fetchInsight(tone),
    // Until asked, nothing is fetched; one asked for earlier in this visit
    // is still in the cache and shows straight away.
    enabled: asked[tone],
    staleTime: 5 * 60 * 1000,
    // A failure is shown with Try again; retrying by itself would spend more
    // of the day's writes.
    retry: false,
  });
  const copy = COPY[tone];

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

      {data ? (
        <article className="max-w-2xl animate-result-in motion-reduce:animate-none" key={tone}>
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-ink-50 text-balance">
            {data.headline}
          </h3>
          <div className="mt-4 space-y-3 text-ink-300 leading-relaxed">
            {data.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </article>
      ) : !asked[tone] ? (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-ink-300 max-w-xl">{copy.offer}</p>
          <Button
            variant="secondary"
            className="cursor-pointer self-start sm:self-auto shrink-0"
            onClick={() => setAsked((prev) => ({ ...prev, [tone]: true }))}
          >
            {copy.action}
          </Button>
        </div>
      ) : isError ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-ink-300">{error.message}</p>
          <Button
            variant="secondary"
            size="sm"
            className="cursor-pointer"
            onClick={() => refetch()}
            isLoading={isRefetching}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div aria-busy="true">
          <p className="text-sm text-ink-400 mb-4">{copy.writing}</p>
          <Skeleton className="h-6 w-2/3 mb-5" />
          <div className="space-y-2.5 max-w-2xl">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      )}
    </Panel>
  );
}
