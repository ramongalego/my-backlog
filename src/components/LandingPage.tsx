'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import Image, { getImageProps } from 'next/image';
import dynamic from 'next/dynamic';

import { Button } from '@/components/ui/Button';
import type { User } from '@supabase/supabase-js';
import type { AuthMode } from '@/types/auth';

// The auth forms pull in supabase-js; load them only when the modal opens.
const AuthModal = dynamic(() => import('@/components/auth/AuthModal').then((m) => m.AuthModal));

interface LandingPageProps {
  user: User | null;
  onConnectSteam?: () => void;
}

const MOCK_LIBRARY = [
  {
    image: '/lp_hades.jpg',
    title: 'Hades',
    status: 'Playing',
    pill: 'bg-accent-500 text-ink-950',
  },
  {
    image: '/lp_disco.jpeg',
    title: 'Disco Elysium',
    status: 'Backlog',
    pill: 'bg-ink-800 text-ink-300',
  },
  {
    image: '/lp_hk.jpeg',
    title: 'Hollow Knight',
    status: 'Finished',
    pill: 'bg-emerald-500/15 text-emerald-400',
  },
  {
    image: '/lp_celeste.png',
    title: 'Celeste',
    status: 'Finished',
    pill: 'bg-emerald-500/15 text-emerald-400',
  },
  {
    image: '/lp_cyberpunk.jpg',
    title: 'Cyberpunk 2077',
    status: 'Backlog',
    pill: 'bg-ink-800 text-ink-300',
  },
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
    meta: '~27h to beat · 9.8 rating',
    moods: ['Adrenaline'],
    energies: ['High'],
    times: ['A few nights'],
  },
  {
    image: '/lp_hades.jpg',
    title: 'Hades',
    meta: '~23h to beat · 9.3 rating',
    moods: ['Adrenaline'],
    energies: ['High', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_celeste.png',
    title: 'Celeste',
    meta: '~8h to beat · 9.4 rating',
    moods: ['Emotional'],
    energies: ['High'],
    times: ['One session'],
  },
  {
    image: '/lp_disco.jpeg',
    title: 'Disco Elysium',
    meta: '~23h to beat · 9.5 rating',
    moods: ['Engaged'],
    energies: ['Medium', 'Low'],
    times: ['Long haul'],
  },
  {
    image: '/lp_portal.jpg',
    title: 'Portal 2',
    meta: '~9h to beat · 9.5 rating',
    moods: ['Engaged'],
    energies: ['Medium', 'Low'],
    times: ['One session', 'A few nights'],
  },
  {
    image: '/lp_cyberpunk.jpg',
    title: 'Cyberpunk 2077',
    meta: '~26h to beat · 8.7 rating',
    moods: ['Adrenaline'],
    energies: ['Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_eldenring.jpg',
    title: 'Elden Ring',
    meta: '~60h to beat · 9.6 rating',
    moods: ['Adrenaline'],
    energies: ['High'],
    times: ['Long haul'],
  },
  {
    image: '/lp_vampire.jpg',
    title: 'Vampire Survivors',
    meta: '~15h to beat · 9.1 rating',
    moods: ['Adrenaline'],
    energies: ['Low'],
    times: ['One session', 'A few nights'],
  },
  {
    image: '/lp_stardew.png',
    title: 'Stardew Valley',
    meta: '~53h to beat · 9.5 rating',
    moods: ['Relaxed'],
    energies: ['Low', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_shorthike.png',
    title: 'A Short Hike',
    meta: '~2h to beat · 9.4 rating',
    moods: ['Relaxed'],
    energies: ['Low'],
    times: ['One session'],
  },
  {
    image: '/lp_dorf.webp',
    title: 'Dorfromantik',
    meta: '~18h to beat · 8.8 rating',
    moods: ['Relaxed'],
    energies: ['Medium', 'Low'],
    times: ['One session', 'A few nights'],
  },
  {
    image: '/lp_dave.webp',
    title: 'Dave the Diver',
    meta: '~25h to beat · 9.0 rating',
    moods: ['Relaxed'],
    energies: ['High', 'Medium'],
    times: ['A few nights'],
  },
  {
    image: '/lp_outerwilds.jpg',
    title: 'Outer Wilds',
    meta: '~17h to beat · 9.7 rating',
    moods: ['Engaged', 'Emotional'],
    energies: ['High', 'Medium'],
    times: ['A few nights'],
  },
  {
    image: '/lp_bg3.jpg',
    title: "Baldur's Gate 3",
    meta: '~73h to beat · 9.7 rating',
    moods: ['Engaged'],
    energies: ['High', 'Medium'],
    times: ['Long haul'],
  },
  {
    image: '/lp_slaythespire.jpg',
    title: 'Slay the Spire',
    meta: '~12h to beat · 9.2 rating',
    moods: ['Engaged'],
    energies: ['High', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_journey.jpg',
    title: 'Journey',
    meta: '~2h to beat · 9.4 rating',
    moods: ['Emotional', 'Relaxed'],
    energies: ['Low'],
    times: ['One session'],
  },
  {
    image: '/lp_firewatch.jpg',
    title: 'Firewatch',
    meta: '~4h to beat · 8.8 rating',
    moods: ['Emotional'],
    energies: ['Low', 'Medium'],
    times: ['One session'],
  },
  {
    image: '/lp_spiritfarer.jpg',
    title: 'Spiritfarer',
    meta: '~26h to beat · 9.1 rating',
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
  { label: 'Finished', pct: 18, color: 'bg-emerald-500' },
  { label: 'Dropped', pct: 9, color: 'bg-rose-500' },
  { label: 'Backlog', pct: 73, color: 'bg-ink-500' },
];

function ChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="text-sm text-ink-300 mb-2.5">{label}</p>
      <div className="flex gap-1.5 flex-wrap" role="group" aria-label={label}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={selected}
              className={`h-8 px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                selected
                  ? 'bg-ink-100 text-ink-950'
                  : 'bg-ink-800 text-ink-300 hover:bg-ink-700 hover:text-ink-50'
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

export function LandingPage({ user, onConnectSteam }: LandingPageProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  const [mood, setMood] = useState<Mood>('Adrenaline');
  const [energy, setEnergy] = useState<Energy>('High');
  const [time, setTime] = useState<Time>('A few nights');
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

  const primaryCta = user ? (
    <Button size="lg" onClick={onConnectSteam}>
      Connect Your Steam
    </Button>
  ) : (
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
              <h1 className="text-5xl md:text-6xl font-semibold text-ink-50 leading-[1.05] tracking-tight">
                Stop scrolling.
                <br />
                <span className="text-accent-400">Start playing.</span>
              </h1>
              <p className="mt-6 text-lg md:text-xl text-ink-300 max-w-lg leading-relaxed">
                Your Steam library has hundreds of games. We help you actually play them, and finish
                them.
              </p>
              <p className="mt-3 text-sm text-ink-400 h-5 leading-5" aria-live="off">
                <span key={teaseIndex} className="inline-block animate-[resultPop_0.3s_ease-out]">
                  {HERO_TEASES[teaseIndex]}
                </span>
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4">
                {primaryCta}
                {user ? (
                  <p className="text-sm text-ink-400">Free · syncs with your Steam library</p>
                ) : (
                  <button
                    onClick={() => openModal('login')}
                    className="text-sm text-ink-400 hover:text-ink-100 transition-colors cursor-pointer"
                  >
                    Already have an account?{' '}
                    <span className="font-medium text-ink-200 underline decoration-ink-600 underline-offset-4">
                      Sign in
                    </span>
                  </button>
                )}
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
            <SectionCopy title="Three questions, one game for tonight">
              <p>
                You know the drill: you sit down to play, spend 20 minutes scrolling through your
                library, and end up watching YouTube instead.
              </p>
              <p>
                Answer three quick questions about your mood, your energy, and how much time you
                have. We&apos;ll surface the right game from your own library. Try it:
              </p>
            </SectionCopy>

            <div className="bg-ink-900 rounded-2xl p-5 sm:p-6 space-y-5">
              <ChoiceGroup
                label="What do you want to feel?"
                options={MOODS}
                value={mood}
                onChange={setMood}
              />
              <ChoiceGroup
                label="How much mental energy do you have?"
                options={ENERGIES}
                value={energy}
                onChange={setEnergy}
              />
              <ChoiceGroup
                label="How much time do you have?"
                options={TIMES}
                value={time}
                onChange={setTime}
              />
              <div
                key={pickedGame.title}
                className="flex items-center gap-4 border-t border-ink-800 pt-5 animate-[resultPop_0.3s_ease-out]"
                aria-live="polite"
              >
                <Image
                  src={pickedGame.image}
                  alt={pickedGame.title}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-50">{pickedGame.title}</p>
                  <p className="text-sm text-ink-400">{pickedGame.meta}</p>
                </div>
                <span className="text-sm font-medium px-3 h-8 inline-flex items-center bg-accent-500 rounded-lg text-ink-950 shrink-0">
                  Play this
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Library ── */}
        <section className="border-t border-ink-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <div className="bg-ink-900 rounded-2xl overflow-hidden order-last lg:order-first">
              <div className="px-5 py-4 border-b border-ink-800 flex items-center justify-between">
                <span className="text-sm font-medium text-ink-200">My Library</span>
                <span className="text-sm text-ink-400">457 games</span>
              </div>
              <div className="divide-y divide-ink-800/70">
                {MOCK_LIBRARY.map((game) => (
                  <div key={game.title} className="flex items-center gap-3.5 px-5 py-3">
                    <Image
                      src={game.image}
                      alt={game.title}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-md object-cover shrink-0"
                    />
                    <span className="text-sm text-ink-200 flex-1 min-w-0 truncate">
                      {game.title}
                    </span>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-md shrink-0 ${game.pill}`}
                    >
                      {game.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <SectionCopy title="Your whole Steam library, finally sorted">
              <p>
                Hundreds of games, bought across years of sales. You probably have no idea what you
                actually own anymore.
              </p>
              <p>
                MyBacklog pulls your full Steam library and lets you see it all clearly. Mark games
                as playing, finished, dropped, or hidden. Rate the ones you finish, jot down your
                thoughts. Filter and sort however you want.
              </p>
            </SectionCopy>
          </div>
        </section>

        {/* ── Momentum ── */}
        <section className="border-t border-ink-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">
            <SectionCopy title="A queue, a diary, and stats that keep you finishing">
              <p>
                Finishing one game feels good. Finishing ten feels like you&apos;re actually making
                progress.
              </p>
              <p>
                Queue up what&apos;s next so you never start a session without a plan. Log every
                game you finish, with a rating and notes. Then open Stats and watch your completion
                rate climb.
              </p>
            </SectionCopy>

            <div className="bg-ink-900 rounded-2xl divide-y divide-ink-800">
              <div className="px-5 py-4">
                <p className="text-sm font-medium text-ink-200 mb-3">Up next</p>
                <ol className="space-y-2.5">
                  {[
                    { name: 'Disco Elysium', image: '/lp_disco.jpeg' },
                    { name: 'Celeste', image: '/lp_celeste.png' },
                    { name: 'Portal 2', image: '/lp_portal.jpg' },
                  ].map((game, i) => (
                    <li key={game.name} className="flex items-center gap-3">
                      <span className="text-sm text-ink-500 w-3 shrink-0 tabular-nums">
                        {i + 1}
                      </span>
                      <Image
                        src={game.image}
                        alt={game.name}
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
                  alt="Hollow Knight"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-ink-200">Hollow Knight</span>
                    <span className="text-xs text-ink-400">Jan 2025</span>
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
            </div>
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
                Free to use. Your Steam library, synced and ready to go.
              </p>
            </div>
            <div className="shrink-0">{primaryCta}</div>
          </div>
        </section>
      </main>

      {isAuthModalOpen && (
        <AuthModal isOpen onClose={() => setIsAuthModalOpen(false)} initialMode={authMode} />
      )}
    </div>
  );
}
