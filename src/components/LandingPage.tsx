'use client';

import { Suspense, useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import Image, { getImageProps } from 'next/image';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { StatusBadge } from '@/components/games/StatusBadge';
import { STATUS_STYLE, type GameStatus } from '@/lib/games/status-style';
import type { AuthMode } from '@/types/auth';

// The auth forms pull in supabase-js; load them only when the modal opens.
const AuthModal = dynamic(() => import('@/components/auth/AuthModal').then((m) => m.AuthModal));

const MOCK_LIBRARY: { image: string; title: string; status: GameStatus }[] = [
  { image: '/lp_hades.jpg', title: 'Hades', status: 'playing' },
  { image: '/lp_disco.jpeg', title: 'Disco Elysium', status: 'backlog' },
  { image: '/lp_hk.jpeg', title: 'Hollow Knight', status: 'finished' },
  { image: '/lp_celeste.png', title: 'Celeste', status: 'finished' },
  { image: '/lp_cyberpunk.jpg', title: 'Cyberpunk 2077', status: 'backlog' },
];

const HERO_TEASES = [
  'Like that Elden Ring save from last summer',
  'Like the Disco Elysium playthrough you promised',
  "Like the Baldur's Gate 3 run you restarted twice",
  'Like the Civ save still waiting from 2019',
  'Like the sale bundle you forgot you bought',
  "Like the Hades run you're one boss away from",
];

type Mood = 'Adrenaline' | 'Relaxed' | 'Engaged' | 'Emotional';
type Energy = 'High' | 'Medium' | 'Low';
type Time = 'One session' | 'A few nights' | 'Long haul';

const MOODS: Mood[] = ['Adrenaline', 'Relaxed', 'Engaged', 'Emotional'];
const ENERGIES: Energy[] = ['High', 'Medium', 'Low'];
const TIMES: Time[] = ['One session', 'A few nights', 'Long haul'];
// What each answer means, as the app's own question says it.
const TIME_HINTS: Record<Time, string> = {
  'One session': 'Under 5 hours to beat, or built around short runs',
  'A few nights': '5 to 15 hours to beat',
  'Long haul': '15 hours or more',
};

type PickerGame = {
  image: string;
  title: string;
  meta: string;
  moods: Mood[];
  energies: Energy[];
  times: Time[];
};

const PICKER_GAMES: PickerGame[] = [
  {
    image: '/lp_hk.jpeg',
    title: 'Hollow Knight',
    meta: '~27h to beat · 87 critic score',
    moods: ['Adrenaline'],
    energies: ['High'],
    times: ['Long haul'],
  },
  {
    image: '/lp_hades.jpg',
    title: 'Hades',
    meta: '~23h to beat · 93 critic score',
    moods: ['Adrenaline'],
    energies: ['High', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_celeste.png',
    title: 'Celeste',
    meta: '~8h to beat · 92 critic score',
    moods: ['Emotional'],
    energies: ['High'],
    times: ['A few nights'],
  },
  {
    image: '/lp_disco.jpeg',
    title: 'Disco Elysium',
    meta: '~23h to beat · 91 critic score',
    moods: ['Engaged'],
    energies: ['Medium', 'Low'],
    times: ['Long haul'],
  },
  {
    image: '/lp_portal.jpg',
    title: 'Portal 2',
    meta: '~9h to beat · 95 critic score',
    moods: ['Engaged'],
    energies: ['Medium', 'Low'],
    times: ['A few nights'],
  },
  {
    image: '/lp_cyberpunk.jpg',
    title: 'Cyberpunk 2077',
    meta: '~26h to beat · 86 critic score',
    moods: ['Adrenaline'],
    energies: ['Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_eldenring.jpg',
    title: 'Elden Ring',
    meta: '~60h to beat · 94 critic score',
    moods: ['Adrenaline'],
    energies: ['High'],
    times: ['Long haul'],
  },
  {
    image: '/lp_vampire.jpg',
    title: 'Vampire Survivors',
    meta: '~15h to beat · 86 critic score',
    moods: ['Adrenaline'],
    energies: ['Low'],
    times: ['One session', 'A few nights'],
  },
  {
    image: '/lp_stardew.png',
    title: 'Stardew Valley',
    meta: '~53h to beat · 89 critic score',
    moods: ['Relaxed'],
    energies: ['Low', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_shorthike.png',
    title: 'A Short Hike',
    meta: '~2h to beat · 87 critic score',
    moods: ['Relaxed'],
    energies: ['Low'],
    times: ['One session'],
  },
  {
    image: '/lp_dorf.webp',
    title: 'Dorfromantik',
    meta: '~18h to beat · 83 critic score',
    moods: ['Relaxed'],
    energies: ['Medium', 'Low'],
    times: ['Long haul'],
  },
  {
    image: '/lp_dave.webp',
    title: 'Dave the Diver',
    meta: '~25h to beat · 90 critic score',
    moods: ['Relaxed'],
    energies: ['High', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_outerwilds.jpg',
    title: 'Outer Wilds',
    meta: '~17h to beat · 85 critic score',
    moods: ['Engaged', 'Emotional'],
    energies: ['High', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_bg3.jpg',
    title: "Baldur's Gate 3",
    meta: '~73h to beat · 96 critic score',
    moods: ['Engaged'],
    energies: ['High', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_slaythespire.jpg',
    title: 'Slay the Spire',
    meta: '~12h to beat · 89 critic score',
    moods: ['Engaged'],
    energies: ['High', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_journey.jpg',
    title: 'Journey',
    meta: '~2h to beat · 92 critic score',
    moods: ['Emotional', 'Relaxed'],
    energies: ['Low'],
    times: ['One session'],
  },
  {
    image: '/lp_firewatch.jpg',
    title: 'Firewatch',
    meta: '~4h to beat · 81 critic score',
    moods: ['Emotional'],
    energies: ['Low', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_spiritfarer.jpg',
    title: 'Spiritfarer',
    meta: '~26h to beat · 84 critic score',
    moods: ['Emotional', 'Relaxed'],
    energies: ['Low', 'Medium'],
    times: ['Long haul'],
  },
];

function pickGame(mood: Mood, energy: Energy, time: Time): PickerGame {
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

// Box art for the hero shelf, in three columns. The middle column sits lower
// so the covers read as a stack you're browsing, not a uniform grid.
const HERO_SHELF: { image: string; title: string; playing?: boolean }[][] = [
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

const BREAKDOWN = [
  { label: 'Finished', pct: 18, color: STATUS_STYLE.finished.fill },
  { label: 'Dropped', pct: 9, color: STATUS_STYLE.dropped.fill },
  { label: 'Backlog', pct: 73, color: STATUS_STYLE.backlog.fill },
];

function SectionCopy({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="max-w-lg">
      <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-ink-50 leading-tight mb-5">
        {title}
      </h2>
      <div className="space-y-4 text-ink-400 leading-relaxed">{children}</div>
    </div>
  );
}

export function LandingPage() {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  const [mood, setMood] = useState<Mood>('Adrenaline');
  const [energy, setEnergy] = useState<Energy>('High');
  const [time, setTime] = useState<Time>('Long haul');
  const pickedGame = pickGame(mood, energy, time);

  const [teaseIndex, setTeaseIndex] = useState(0);

  useEffect(() => {
    // Keep the first tagline still for users who asked for reduced motion.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      setTeaseIndex((i) => (i + 1) % HERO_TEASES.length);
    }, 3200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // Warm the cache with the exact URLs next/image will request, so picker
    // results swap in without pop-in. getImageProps keeps this in sync with
    // the loader config (width snapping, qualities allowlist).
    for (const game of PICKER_GAMES) {
      const { props } = getImageProps({ src: game.image, alt: '', width: 56, height: 56 });
      const img = new window.Image();
      if (props.srcSet) img.srcset = props.srcSet;
      img.src = props.src;
    }
  }, []);

  const openModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const primaryCta = (
    <Button size="lg" onClick={() => openModal('signup')}>
      Get Started
    </Button>
  );

  return (
    <div className="min-h-screen bg-ink-950 flex flex-col">
      <main id="main-content" className="pt-16 flex-1">
        {/* ── Hero ── */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(0,26rem)] gap-14 lg:gap-20 items-center">
            <div>
              {/* Sized so each half fits on one line, including the narrower two-column range. */}
              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl xl:text-6xl font-semibold text-ink-50 leading-[1.05] tracking-tight">
                Play the games
                <br />
                <span className="text-accent-400">you already own</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-ink-300 max-w-lg leading-relaxed">
                MyBacklog imports your Steam library, or the games you add from any console, and
                picks one for tonight based on your mood and how much time you have
              </p>
              <p className="mt-3 text-sm text-ink-400 h-5 leading-5" aria-live="off">
                <span
                  key={teaseIndex}
                  className="inline-block animate-[resultPop_0.3s_ease-out] motion-reduce:animate-none"
                >
                  {HERO_TEASES[teaseIndex]}
                </span>
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
                {primaryCta}
                <button
                  onClick={() => openModal('login')}
                  className="text-sm text-ink-400 hover:text-ink-100 transition-colors cursor-pointer"
                >
                  Already have an account?{' '}
                  <span className="font-medium text-ink-200 underline decoration-ink-600 underline-offset-4">
                    Sign in
                  </span>
                </button>
              </div>
            </div>

            {/* Shelf of box art */}
            <div
              className="grid grid-cols-3 gap-3 sm:gap-4 max-w-sm sm:max-w-md lg:max-w-none"
              aria-hidden="true"
            >
              {HERO_SHELF.map((column, c) => (
                <div key={c} className={`space-y-3 sm:space-y-4 ${c === 1 ? 'pt-10' : ''}`}>
                  {column.map((game, r) => (
                    <div
                      key={game.title}
                      // Phones get one row of covers so the shelf doesn't fill the screen.
                      className={`${r > 0 ? 'hidden sm:block ' : ''}relative aspect-[2/3] overflow-hidden rounded-lg bg-ink-900 after:absolute after:inset-0 after:rounded-lg after:ring-1 after:ring-inset after:ring-white/10`}
                    >
                      <Image
                        src={game.image}
                        alt=""
                        fill
                        priority
                        sizes="(max-width: 1024px) 30vw, 140px"
                        className="object-cover"
                      />
                      {game.playing && (
                        <span className="absolute left-2 bottom-2 z-10 inline-flex items-center gap-1.5 rounded-md bg-accent-500 px-2 py-0.5 text-xs font-semibold text-ink-950">
                          Playing
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Game picker ── */}
        <section className="border-t border-ink-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <SectionCopy title="Pick tonight's game in three questions">
              <p>
                You sit down to play, scroll through your library for 20 minutes, and end up
                watching YouTube instead.
              </p>
              <p>
                Say how you want to feel, how much energy you have and how long you can play, and
                MyBacklog picks a game you already own. Try it:
              </p>
            </SectionCopy>

            <Panel className="space-y-5">
              <div>
                <p className="text-sm text-ink-300 mb-2.5">What do you want to feel?</p>
                <ToggleGroup
                  label="What do you want to feel?"
                  value={mood}
                  onChange={setMood}
                  options={MOODS.map((v) => ({ value: v, label: v }))}
                />
              </div>
              <div>
                <p className="text-sm text-ink-300 mb-2.5">How much mental energy do you have?</p>
                <ToggleGroup
                  label="How much mental energy do you have?"
                  value={energy}
                  onChange={setEnergy}
                  options={ENERGIES.map((v) => ({ value: v, label: v }))}
                />
              </div>
              <div>
                <p className="text-sm text-ink-300 mb-2.5">How much time do you have?</p>
                <ToggleGroup
                  label="How much time do you have?"
                  value={time}
                  onChange={setTime}
                  options={TIMES.map((v) => ({ value: v, label: v }))}
                />
                <p className="mt-2 text-xs text-ink-500">{TIME_HINTS[time]}</p>
              </div>
              <div
                key={pickedGame.title}
                className="flex items-center gap-4 border-t border-ink-800 pt-5 animate-[resultPop_0.3s_ease-out] motion-reduce:animate-none"
                aria-live="polite"
              >
                <Image
                  src={pickedGame.image}
                  alt=""
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-50">{pickedGame.title}</p>
                  <p className="text-sm text-ink-400">{pickedGame.meta}</p>
                </div>
                {/* The demo's pick leads to signing up, where it's your own library. */}
                <Button
                  size="sm"
                  className="shrink-0 cursor-pointer"
                  onClick={() => openModal('signup')}
                >
                  Play this
                </Button>
              </div>
            </Panel>
          </div>
        </section>

        {/* ── Library ── */}
        <section className="border-t border-ink-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <Panel padding="none" className="overflow-hidden order-last lg:order-first">
              <div className="px-5 py-4 border-b border-ink-800 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-200">My Library</span>
                <span className="text-sm text-ink-400">457 games</span>
              </div>
              <div className="divide-y divide-ink-800/70">
                {MOCK_LIBRARY.map((game) => (
                  <div key={game.title} className="flex items-center gap-3.5 px-5 py-3">
                    <Image
                      src={game.image}
                      alt=""
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-md object-cover shrink-0"
                    />
                    <span className="text-sm text-ink-200 flex-1 min-w-0 truncate">
                      {game.title}
                    </span>
                    <span className="shrink-0">
                      <StatusBadge status={game.status} showBacklog />
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <SectionCopy title="Your whole gaming library in one place">
              <p>
                Years of sales add up to hundreds of games, and it&apos;s easy to lose track of what
                you own.
              </p>
              <p>
                Connect Steam to bring them all in, or add games from any console. Each one comes
                with how long it takes to beat and how well it&apos;s reviewed, ready to mark, rate
                and sort however you like.
              </p>
            </SectionCopy>
          </div>
        </section>

        {/* ── Momentum ── */}
        <section className="border-t border-ink-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <SectionCopy title="A queue for what's next, a diary for what you finish">
              <p>
                Line up the next few games, so when you finish one you already know what to start.
              </p>
              <p>
                Every game you finish goes in your diary with the date, your rating and a note.
                Stats shows how much of your library you&apos;ve finished and how long the rest
                would take at your pace.
              </p>
            </SectionCopy>

            <Panel padding="none" className="divide-y divide-ink-800">
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-ink-200 mb-3">Up next</p>
                <ol className="space-y-2.5">
                  {[
                    { name: 'Disco Elysium', image: '/lp_disco.jpeg' },
                    { name: 'Outer Wilds', image: '/lp_outerwilds.jpg' },
                    { name: 'Portal 2', image: '/lp_portal.jpg' },
                  ].map((game, i) => (
                    <li key={game.name} className="flex items-center gap-3">
                      <span className="text-sm text-ink-500 w-3 shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <Image
                        src={game.image}
                        alt=""
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded object-cover shrink-0"
                      />
                      <span className="text-sm text-ink-300">{game.name}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="px-5 py-4 flex items-start gap-4">
                <Image
                  src="/lp_hk.jpeg"
                  alt=""
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink-200">Hollow Knight</span>
                    <span className="text-xs text-ink-400">Sep 2026</span>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-ink-200">
                    <Star
                      className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                      aria-hidden="true"
                    />
                    10/10
                  </p>
                  <p className="mt-1 text-sm text-ink-400 truncate">
                    One of the best I&apos;ve ever played.
                  </p>
                </div>
              </div>

              <div className="px-5 py-4">
                <p className="text-sm font-medium text-ink-200 mb-3">Library breakdown</p>
                <div className="flex h-2 rounded-full overflow-hidden gap-px">
                  {BREAKDOWN.map((s) => (
                    <div key={s.label} className={s.color} style={{ width: `${s.pct}%` }} />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                  {BREAKDOWN.map((s) => (
                    <span key={s.label} className="flex items-center gap-2 text-sm text-ink-400">
                      <span className={`w-2 h-2 rounded-full ${s.color}`} aria-hidden="true" />
                      {s.label}
                      <span className="text-ink-200 font-medium">{s.pct}%</span>
                    </span>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="border-t border-ink-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight text-ink-50 leading-tight">
                Start clearing your backlog tonight
              </h2>
              <p className="mt-3 text-ink-400">
                It&apos;s free. Connect Steam to import your whole library, or add games from any
                console
              </p>
            </div>
            <div className="shrink-0">{primaryCta}</div>
          </div>
        </section>
      </main>

      <Suspense fallback={null}>
        {isAuthModalOpen && (
          <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} initialMode={authMode} />
        )}
      </Suspense>
    </div>
  );
}
