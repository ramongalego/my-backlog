import { cache } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Gamepad2, Trophy, Star, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { SHARED_COMPLETION_COLUMNS } from '@/lib/share/completion';
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

  const steamHours = Math.round((data.playtime_minutes / 60) * 10) / 10;

  return (
    <div className="min-h-screen bg-ink-950">
      <main id="main-content" className="pt-16 pb-16">
        <div className="max-w-lg mx-auto px-6">
          {/* Card */}
          <div className="bg-ink-900 border border-ink-800 rounded-2xl overflow-hidden">
            {/* Hero image */}
            <div className="relative h-44 overflow-hidden">
              {data.header_image ? (
                <Image
                  src={data.header_image}
                  alt={data.game_name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 100vw, 512px"
                />
              ) : (
                <div className="w-full h-full bg-ink-800 flex items-center justify-center">
                  <Gamepad2 className="w-10 h-10 text-ink-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/40 to-transparent" />
              <h1 className="absolute bottom-3 left-6 right-6 text-xl font-semibold tracking-tight text-ink-50 leading-tight line-clamp-2">
                {data.game_name}
              </h1>
            </div>

            <div className="p-6 space-y-5">
              {/* Tagline */}
              <div className="flex items-center gap-2 text-sm">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <p className="text-ink-100 font-medium">Game completed!</p>
              </div>

              {/* Playtime */}
              {steamHours > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-ink-100">{steamHours}h of playtime</span>
                </div>
              )}

              {/* Rating */}
              {data.rating !== null && (
                <div className="flex items-center gap-2 text-sm">
                  <Star className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
                  <span className="flex items-center gap-1.5">
                    <span className="text-ink-400">Rated</span>
                    <span className="text-ink-100 font-semibold">{data.rating}</span>
                    <span className="text-ink-500">/ 10</span>
                  </span>
                </div>
              )}

              {/* Stats */}
              {(data.total_games > 0 || data.backlog_hours_removed) && (
                <div className="flex divide-x divide-ink-800 py-3">
                  {data.total_games > 0 && (
                    <div
                      className={`text-center ${data.backlog_hours_removed ? 'flex-1 pr-3' : 'w-full'}`}
                    >
                      <p className="text-2xl font-semibold tracking-tight text-ink-50">
                        {data.games_finished}/{data.total_games}
                      </p>
                      <p className="text-xs text-ink-500 mt-1">games finished</p>
                    </div>
                  )}
                  {data.backlog_hours_removed && (
                    <div
                      className={`text-center ${data.total_games > 0 ? 'flex-1 pl-3' : 'w-full'}`}
                    >
                      <p className="text-2xl font-semibold tracking-tight text-emerald-400">
                        -{data.backlog_hours_removed}h
                      </p>
                      <p className="text-xs text-ink-500 mt-1">from backlog</p>
                    </div>
                  )}
                </div>
              )}

              {/* Next up */}
              {data.next_game && (
                <div className="flex items-center gap-2 text-sm">
                  <ChevronRight className="w-4 h-4 text-ink-400 shrink-0" />
                  <span className="text-ink-400">Next up:</span>
                  <span className="font-semibold text-ink-100 truncate">{data.next_game}</span>
                </div>
              )}
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
