'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query-keys';

interface GameForStats {
  app_id: number;
  name: string;
  status: string | null;
  playtime_forever: number;
  main_story_hours: number | null;
  tags: string[] | null;
  rating: number | null;
  finished_at: string | null;
  header_image: string | null;
  release_date: string | null;
  deck_compat: number | null;
}

export interface TagStat {
  tag: string;
  count: number;
}

export interface TagCompletion {
  tag: string;
  total: number;
  finished: number;
  pct: number;
}

export interface YearStat {
  year: string;
  count: number;
}

export interface RatingBar {
  rating: number;
  count: number;
}

export interface MostPlayedUnfinished {
  app_id: number;
  name: string;
  playtime_forever: number;
  main_story_hours: number | null;
  header_image: string | null;
  deck_compat: number | null;
}

export interface Stats {
  total: number;
  finished: number;
  dropped: number;
  backlog: number;
  playing: number;
  finishedPct: number;
  droppedPct: number;
  backlogPct: number;
  playingPct: number;
  totalPlaytimeHours: number;
  totalPlaytimeDays: number;
  estimatedBacklogHours: number;
  topTags: TagStat[];
  tagCompletion: TagCompletion[];
  avgRating: number | null;
  ratedCount: number;
  finishedByYear: YearStat[];
  gamesByReleaseYear: YearStat[];
  ratingDistribution: RatingBar[];
  mostPlayedUnfinished: MostPlayedUnfinished[];
}

function parseYear(releaseDate: string | null): string | null {
  if (!releaseDate) return null;
  const m = releaseDate.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
}

async function fetchStatsGames(): Promise<GameForStats[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('games')
    .select(
      'app_id, name, status, playtime_forever, main_story_hours, tags, rating, finished_at, header_image, release_date, deck_compat',
    )
    .eq('user_id', user.id)
    .eq('type', 'game')
    .neq('status', 'hidden');

  return (data || []) as GameForStats[];
}

export function useStats() {
  const { data: games = [], isPending } = useQuery({
    queryKey: queryKeys.games.stats(),
    queryFn: fetchStatsGames,
    staleTime: 5 * 60 * 1000,
  });

  const stats = useMemo((): Stats | null => {
    if (games.length === 0) return null;

    const total = games.length;
    const finished = games.filter((g) => g.status === 'finished').length;
    const dropped = games.filter((g) => g.status === 'dropped').length;
    const playing = games.filter((g) => g.status === 'playing').length;
    const backlog = total - finished - dropped - playing;

    const rawPlaytimeMins = games.reduce((sum, g) => sum + g.playtime_forever, 0);
    const totalPlaytimeHours = Math.round(rawPlaytimeMins / 60);
    const totalPlaytimeDays = Math.round((rawPlaytimeMins / 60 / 24) * 10) / 10;

    const estimatedBacklogHours = Math.round(
      games
        .filter((g) => !g.status || g.status === 'backlog')
        .reduce((sum, g) => sum + (g.main_story_hours ?? 0), 0),
    );

    // Tags — aggregate across all games
    const EXCLUDED_TAGS = new Set([
      'Singleplayer',
      'Multiplayer',
      'Single-player',
      'Multi-player',
      'Quick-Time Events',
      'Reboot',
    ]);

    const tagCounts = new Map<string, number>();
    const tagFinishedCounts = new Map<string, number>();

    for (const game of games) {
      if (!game.tags) continue;
      for (const tag of game.tags) {
        if (EXCLUDED_TAGS.has(tag)) continue;
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        if (game.status === 'finished') {
          tagFinishedCounts.set(tag, (tagFinishedCounts.get(tag) ?? 0) + 1);
        }
      }
    }

    const topTags: TagStat[] = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    const tagCompletion: TagCompletion[] = [...tagCounts.entries()]
      .filter(([, count]) => count >= 3)
      .map(([tag, total]) => {
        const fin = tagFinishedCounts.get(tag) ?? 0;
        return { tag, total, finished: fin, pct: Math.round((fin / total) * 100) };
      })
      .sort((a, b) => b.pct * Math.log(b.total) - a.pct * Math.log(a.total))
      .slice(0, 12);

    // Average rating on finished + rated games
    const ratedGames = games.filter((g) => g.rating !== null && g.status === 'finished');
    const avgRating =
      ratedGames.length > 0
        ? Math.round((ratedGames.reduce((sum, g) => sum + g.rating!, 0) / ratedGames.length) * 10) /
          10
        : null;

    // Rating distribution — all games with a rating (any status)
    const allRatedGames = games.filter((g) => g.rating !== null);
    const ratingDistribution: RatingBar[] = Array.from({ length: 11 }, (_, i) => ({
      rating: i,
      count: allRatedGames.filter((g) => g.rating === i).length,
    }));

    // Finished by year
    const yearCounts = new Map<string, number>();
    for (const game of games) {
      if (game.finished_at && game.status === 'finished') {
        const year = game.finished_at.slice(0, 4);
        yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
      }
    }
    const finishedByYear: YearStat[] = [...yearCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, count]) => ({ year, count }));

    // Games by release year
    const releaseYearCounts = new Map<string, number>();
    for (const game of games) {
      const year = parseYear(game.release_date);
      if (year) releaseYearCounts.set(year, (releaseYearCounts.get(year) ?? 0) + 1);
    }
    const gamesByReleaseYear: YearStat[] = [...releaseYearCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([year, count]) => ({ year, count }));

    // Most played but still in backlog
    const mostPlayedUnfinished: MostPlayedUnfinished[] = games
      .filter((g) => (!g.status || g.status === 'backlog') && g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 5)
      .map((g) => ({
        app_id: g.app_id,
        name: g.name,
        playtime_forever: g.playtime_forever,
        main_story_hours: g.main_story_hours,
        header_image: g.header_image,
        deck_compat: g.deck_compat ?? null,
      }));

    return {
      total,
      finished,
      dropped,
      backlog,
      playing,
      finishedPct: Math.round((finished / total) * 100),
      droppedPct: Math.round((dropped / total) * 100),
      backlogPct: Math.round((backlog / total) * 100),
      playingPct: Math.round((playing / total) * 100),
      totalPlaytimeHours,
      totalPlaytimeDays,
      estimatedBacklogHours,
      topTags,
      tagCompletion,
      avgRating,
      ratedCount: ratedGames.length,
      finishedByYear,
      gamesByReleaseYear,
      ratingDistribution,
      mostPlayedUnfinished,
    };
  }, [games]);

  return { stats, loading: isPending };
}
