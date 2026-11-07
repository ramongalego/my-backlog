// The games the landing page's picker demo chooses between, and how it picks.
export type Mood = 'Adrenaline' | 'Relaxed' | 'Engaged' | 'Emotional';
export type Energy = 'High' | 'Medium' | 'Low';
export type Time = 'One session' | 'A few nights' | 'Long haul';

export const MOODS: Mood[] = ['Adrenaline', 'Relaxed', 'Engaged', 'Emotional'];
export const ENERGIES: Energy[] = ['High', 'Medium', 'Low'];
export const TIMES: Time[] = ['One session', 'A few nights', 'Long haul'];
// What each answer means, as the app's own question says it.
export const TIME_HINTS: Record<Time, string> = {
  'One session': 'Under 5 hours to beat, or built around short runs',
  'A few nights': '5 to 15 hours to beat',
  'Long haul': '15 hours or more',
};

type PickerGame = {
  image: string;
  title: string;
  /** Time to beat (HowLongToBeat main story) and critic score, as the app shows them. */
  hours: number;
  critic: number;
  moods: Mood[];
  energies: Energy[];
  times: Time[];
};

export const PICKER_GAMES: PickerGame[] = [
  {
    image: '/lp_hk.jpeg',
    title: 'Hollow Knight',
    hours: 27,
    critic: 87,
    moods: ['Adrenaline'],
    energies: ['High'],
    times: ['Long haul'],
  },
  {
    image: '/lp_hades.jpg',
    title: 'Hades',
    hours: 23,
    critic: 93,
    moods: ['Adrenaline'],
    energies: ['High', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_celeste.png',
    title: 'Celeste',
    hours: 8,
    critic: 92,
    moods: ['Emotional'],
    energies: ['High'],
    times: ['A few nights'],
  },
  {
    image: '/lp_disco.jpeg',
    title: 'Disco Elysium',
    hours: 23,
    critic: 91,
    moods: ['Engaged'],
    energies: ['Medium', 'Low'],
    times: ['Long haul'],
  },
  {
    image: '/lp_portal.jpg',
    title: 'Portal 2',
    hours: 9,
    critic: 95,
    moods: ['Engaged'],
    energies: ['Medium', 'Low'],
    times: ['A few nights'],
  },
  {
    image: '/lp_cyberpunk.jpg',
    title: 'Cyberpunk 2077',
    hours: 26,
    critic: 86,
    moods: ['Adrenaline'],
    energies: ['Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_eldenring.jpg',
    title: 'Elden Ring',
    hours: 60,
    critic: 94,
    moods: ['Adrenaline'],
    energies: ['High'],
    times: ['Long haul'],
  },
  {
    image: '/lp_vampire.jpg',
    title: 'Vampire Survivors',
    hours: 15,
    critic: 86,
    moods: ['Adrenaline'],
    energies: ['Low'],
    times: ['One session', 'A few nights'],
  },
  {
    image: '/lp_stardew.png',
    title: 'Stardew Valley',
    hours: 53,
    critic: 89,
    moods: ['Relaxed'],
    energies: ['Low', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_shorthike.png',
    title: 'A Short Hike',
    hours: 2,
    critic: 87,
    moods: ['Relaxed'],
    energies: ['Low'],
    times: ['One session'],
  },
  {
    image: '/lp_dorf.webp',
    title: 'Dorfromantik',
    hours: 18,
    critic: 83,
    moods: ['Relaxed'],
    energies: ['Medium', 'Low'],
    times: ['Long haul'],
  },
  {
    image: '/lp_dave.webp',
    title: 'Dave the Diver',
    hours: 25,
    critic: 90,
    moods: ['Relaxed'],
    energies: ['High', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_outerwilds.jpg',
    title: 'Outer Wilds',
    hours: 17,
    critic: 85,
    moods: ['Engaged', 'Emotional'],
    energies: ['High', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_bg3.jpg',
    title: "Baldur's Gate 3",
    hours: 73,
    critic: 96,
    moods: ['Engaged'],
    energies: ['High', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_slaythespire.jpg',
    title: 'Slay the Spire',
    hours: 12,
    critic: 89,
    moods: ['Engaged'],
    energies: ['High', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_journey.jpg',
    title: 'Journey',
    hours: 2,
    critic: 92,
    moods: ['Emotional', 'Relaxed'],
    energies: ['Low'],
    times: ['One session'],
  },
  {
    image: '/lp_firewatch.jpg',
    title: 'Firewatch',
    hours: 4,
    critic: 81,
    moods: ['Emotional'],
    energies: ['Low', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_spiritfarer.jpg',
    title: 'Spiritfarer',
    hours: 26,
    critic: 84,
    moods: ['Emotional', 'Relaxed'],
    energies: ['Low', 'Medium'],
    times: ['Long haul'],
  },
];

export function pickGame(mood: Mood, energy: Energy, time: Time): PickerGame {
  let best = PICKER_GAMES[0];
  let bestScore = -Infinity;
  for (const game of PICKER_GAMES) {
    // Mood and time are hard constraints (wrong vibe / no time) — mismatches penalize, not just miss out on points.
    // Energy is softer, so it's a lighter tiebreaker.
    const score =
      (game.moods.includes(mood) ? 2 : -2) +
      (game.times.includes(time) ? 2 : -2) +
      (game.energies.includes(energy) ? 1 : -1);
    if (score > bestScore) {
      best = game;
      bestScore = score;
    }
  }
  return best;
}
