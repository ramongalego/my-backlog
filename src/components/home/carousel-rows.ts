import { MIN_CAROUSEL_GAMES } from '@/components/home/GameCarousel';
import type { useHomePage } from '@/hooks/useHomePage';
import type { GameWithImage } from '@/types/games';

interface CarouselRow {
  key: string;
  title: string;
  games: GameWithImage[];
  /** Shows from this many games; MIN_CAROUSEL_GAMES unless set. */
  minGames?: number;
}

/**
 * Home's rows of games, in order, leaving out any with too few to show.
 * Related rows sit together: games you've started, short games, highly rated
 * ones, then what's new. More Like ... may repeat games from the other rows
 * (see useCarouselPools).
 */
export function homeCarouselRows(carousels: ReturnType<typeof useHomePage>['carousels']) {
  const rows: CarouselRow[] = [
    { key: 'pick-up', title: 'Pick Up Where You Left Off', games: carousels.pickUp },
    { key: 'short', title: 'Finish It in One Sitting', games: carousels.shortGames },
    { key: 'weekend', title: 'Finish It in a Weekend', games: carousels.weekendGames },
    { key: 'rated', title: 'Highly Rated, Never Played', games: carousels.highlyRatedGames },
    {
      key: 'more-like',
      title: carousels.moreLike ? `More Like ${carousels.moreLike.basedOn}` : '',
      games: carousels.moreLike?.games ?? [],
    },
    { key: 'gems', title: 'Hidden Gems', games: carousels.hiddenGems },
    // A plain list of what's new, so it shows from the first game: while the
    // backlog is being built, it's the games added so far.
    { key: 'recent', title: 'Recently Added', games: carousels.recentlyAdded, minGames: 1 },
  ];
  return rows.filter((row) => row.games.length >= (row.minGames ?? MIN_CAROUSEL_GAMES));
}
