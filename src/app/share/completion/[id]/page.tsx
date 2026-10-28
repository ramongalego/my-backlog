import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { SHARED_COMPLETION_COLUMNS } from '@/lib/share/completion';
import { ArtHeader } from '@/components/games/ArtHeader';
import { CompletionSummary } from '@/components/games/CompletionSummary';
import type { Metadata } from 'next';

interface PageProps {
  params: Promise<{ id: string }>;
}

// cache() dedupes the lookup between generateMetadata and the page render.
const getCompletion = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('shared_completions')
    .select(SHARED_COMPLETION_COLUMNS)
    .eq('id', id)
    .maybeSingle();
  return data;
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const data = await getCompletion(id);

  if (!data) return {};

  const steamHours = Math.round((data.playtime_minutes / 60) * 10) / 10;
  const ratingPart = data.rating !== null ? `, rated ${data.rating}/10` : '';
  const description = `Finished ${data.game_name} after ${steamHours}h${ratingPart}`;

  return {
    title: `Finished ${data.game_name}`,
    description,
    openGraph: {
      title: `Finished ${data.game_name}`,
      description,
      images: [`/api/og/completion/${id}`],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `Finished ${data.game_name}`,
      description,
      images: [`/api/og/completion/${id}`],
    },
  };
}

export default async function SharedCompletionPage({ params }: PageProps) {
  const { id } = await params;
  const data = await getCompletion(id);

  if (!data) notFound();

  return (
    <div className="min-h-screen bg-ink-950">
      <main id="main-content" className="pt-16 pb-16">
        <div className="max-w-lg mx-auto px-6">
          {/* The same summary the player saw when they finished it. */}
          <div className="bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden">
            <ArtHeader
              src={data.header_image}
              title={data.game_name}
              as="h1"
              bleed={false}
              preload
            />
            <div className="p-6">
              <CompletionSummary
                shared
                playtimeMinutes={data.playtime_minutes}
                mainStoryHours={data.main_story_hours}
                rating={data.rating}
                gamesFinished={data.games_finished}
                totalGames={data.total_games}
                backlogHoursRemoved={data.backlog_hours_removed}
                nextGame={data.next_game}
              />
            </div>
          </div>

          {/* CTA */}
          <div className="text-center mt-8">
            <Link
              href="/"
              className="text-sm text-accent-400 hover:text-accent-300 transition-colors"
            >
              Track your own Steam backlog with MyBacklog
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
