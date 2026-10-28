/** A roast as the API returns it and the cache stores it. */
export interface RoastResponse {
  roast: string;
  steamId: string;
  profile: {
    name: string;
    avatar: string;
    profileUrl: string;
  };
  stats: {
    totalGames: number;
    totalHours: number;
    neverPlayed: number;
  };
}
