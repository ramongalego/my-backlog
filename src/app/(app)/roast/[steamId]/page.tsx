import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HydrationBoundary, QueryClient, dehydrate } from '@tanstack/react-query';
import { getCachedRoast } from '@/lib/roast/cache';
import { queryKeys } from '@/lib/query-keys';
import SharedRoastView from './View';

interface PageProps {
  params: Promise<{ steamId: string }>;
}

const STEAM_ID_PATTERN = /^\d{17}$/;

// Once per request: the metadata and the page both need it.
const loadRoast = cache(async (steamId: string) =>
  STEAM_ID_PATTERN.test(steamId) ? getCachedRoast(steamId) : null,
);

// Per-roast titles and previews so shared links unfurl with the roast itself
// rather than the generic Steam Roast card.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { steamId } = await params;
  const roast = await loadRoast(steamId);
  if (!roast) return {};

  const title = `Steam Roast of ${roast.profile.name}`;
  const description =
    roast.roast.length > 160 ? `${roast.roast.slice(0, 157).trimEnd()}…` : roast.roast;
  return {
    title,
    description,
    openGraph: { title, description, type: 'article', images: [roast.profile.avatar] },
    twitter: { card: 'summary', title, description, images: [roast.profile.avatar] },
  };
}

export default async function SharedRoastPage({ params }: PageProps) {
  const { steamId } = await params;
  if (!STEAM_ID_PATTERN.test(steamId)) notFound();
  const queryClient = new QueryClient();
  // Not roasted yet (null) is known here too, so the page offers to roast it
  // straight away instead of asking again from the browser.
  queryClient.setQueryData(queryKeys.roast.byId(steamId), (await loadRoast(steamId)) ?? null);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SharedRoastView steamId={steamId} />
    </HydrationBoundary>
  );
}
