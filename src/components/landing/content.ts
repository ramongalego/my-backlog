// What the landing page shows: sample games and figures, not the visitor's data.
import { STATUS_STYLE, type GameStatus } from '@/lib/games/status-style';

export const MOCK_LIBRARY: { image: string; title: string; status: GameStatus }[] = [
  { image: '/lp_hades.jpg', title: 'Hades', status: 'playing' },
  { image: '/lp_disco.jpeg', title: 'Disco Elysium', status: 'backlog' },
  { image: '/lp_hk.jpeg', title: 'Hollow Knight', status: 'finished' },
  { image: '/lp_celeste.png', title: 'Celeste', status: 'finished' },
  { image: '/lp_cyberpunk.jpg', title: 'Cyberpunk 2077', status: 'backlog' },
];

export const HERO_TEASES = [
  'Like that Elden Ring save from last summer',
  'Like the Disco Elysium playthrough you promised',
  "Like the Baldur's Gate 3 run you restarted twice",
  'Like the Civ save still waiting from 2019',
  'Like the sale bundle you forgot you bought',
  "Like the Hades run you're one boss away from",
];

// Box art for the hero shelf, in three columns. The middle column sits lower
// so the covers read as a stack you're browsing, not a uniform grid.
export const HERO_SHELF: { image: string; title: string; playing?: boolean }[][] = [
  [
    { image: '/lp_eldenring.jpg', title: 'Elden Ring' },
    { image: '/lp_stardew.png', title: 'Stardew Valley' },
  ],
  [
    { image: '/lp_hades.jpg', title: 'Hades', playing: true },
    { image: '/lp_outerwilds.jpg', title: 'Outer Wilds' },
  ],
  [
    { image: '/lp_bg3.jpg', title: "Baldur's Gate 3" },
    { image: '/lp_dave.webp', title: 'Dave the Diver' },
  ],
];

export const BREAKDOWN = [
  { label: 'Finished', pct: 18, color: STATUS_STYLE.finished.fill },
  { label: 'Dropped', pct: 9, color: STATUS_STYLE.dropped.fill },
  { label: 'Backlog', pct: 73, color: STATUS_STYLE.backlog.fill },
];
