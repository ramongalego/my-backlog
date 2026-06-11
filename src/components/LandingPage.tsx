'use client';

import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import Image, { getImageProps } from 'next/image';

import { Button } from '@/components/ui/Button';
import { AuthModal } from '@/components/auth/AuthModal';
import type { User } from '@supabase/supabase-js';
import type { AuthMode } from '@/types/auth';

interface LandingPageProps {
  user: User | null;
  onConnectSteam?: () => void;
}

const MOCK_LIBRARY = [
  {
    image: '/lp_hades.jpg',
    title: 'Hades',
    status: 'Playing',
    pill: 'bg-sky-500/15 text-sky-400',
  },
  {
    image: '/lp_disco.jpeg',
    title: 'Disco Elysium',
    status: 'Backlog',
    pill: 'bg-violet-500/15 text-violet-400',
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
    pill: 'bg-violet-500/15 text-violet-400',
  },
];

const HERO_PARTICLES = [
  { left: 8, top: 78, duration: 11, delay: 0 },
  { left: 22, top: 88, duration: 14, delay: 2.5 },
  { left: 38, top: 72, duration: 12, delay: 5 },
  { left: 55, top: 90, duration: 15, delay: 1.2 },
  { left: 68, top: 80, duration: 13, delay: 3.8 },
  { left: 82, top: 85, duration: 11, delay: 6 },
  { left: 92, top: 74, duration: 14, delay: 4.3 },
];

const CTA_PARTICLES = [
  { left: 15, top: 82, duration: 12, delay: 0.5 },
  { left: 32, top: 90, duration: 14, delay: 3 },
  { left: 50, top: 78, duration: 11, delay: 1.8 },
  { left: 70, top: 88, duration: 13, delay: 4.5 },
  { left: 88, top: 80, duration: 15, delay: 2.2 },
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

export function LandingPage({ user, onConnectSteam }: LandingPageProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement | null>(null);

  const [mood, setMood] = useState<Mood>('Adrenaline');
  const [energy, setEnergy] = useState<Energy>('High');
  const [time, setTime] = useState<Time>('A few nights');
  const pickedGame = pickGame(mood, energy, time);

  const [teaseIndex, setTeaseIndex] = useState(0);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTeaseIndex((i) => (i + 1) % HERO_TEASES.length);
    }, 2800);
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

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <main id="main-content" className="pt-16 flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[900px] h-[600px] bg-violet-600/8 rounded-full blur-3xl animate-[orbBreathe_10s_ease-in-out_infinite]" />
          </div>

          {/* Drifting particles */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
            {HERO_PARTICLES.map((p, i) => (
              <span
                key={i}
                className="absolute block w-1 h-1 rounded-full bg-violet-300/50"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animation: `floatUp ${p.duration}s ease-in-out ${p.delay}s infinite backwards`,
                }}
              />
            ))}
          </div>

          <div className="relative max-w-4xl mx-auto px-6 py-32 md:py-48 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 mb-8">
              <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-400" />
              </span>
              <span className="text-xs text-violet-300 font-medium tracking-wide">
                Free forever · Syncs with Steam
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-zinc-100 leading-[1.1] tracking-tight mb-6">
              Stop scrolling <br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-[length:200%_auto] animate-[gradientShimmer_8s_ease-in-out_infinite]">
                Start playing
              </span>
            </h1>
            <p className="text-xl text-zinc-400 mb-4 max-w-lg mx-auto leading-relaxed">
              Your Steam library has hundreds of games. We help you actually play them, and finish
              them.
            </p>

            <p
              className="text-sm mb-12 h-5 leading-5 text-center"
              aria-live="polite"
              aria-atomic="true"
            >
              <span
                key={teaseIndex}
                className="inline-block text-violet-300/90 animate-[resultPop_0.4s_ease-out]"
              >
                {HERO_TEASES[teaseIndex]}
              </span>
            </p>

            {user ? (
              <Button size="lg" onClick={onConnectSteam}>
                Connect Your Steam
              </Button>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Button size="lg" onClick={() => openModal('signup')}>
                  Get Started
                </Button>
                <button
                  onClick={() => openModal('login')}
                  className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors"
                >
                  Already have an account? Sign in
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Section 1: Game Picker ── */}
        <section className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <p className="text-xs text-violet-400 uppercase tracking-widest mb-4 font-medium">
                Stop staring at your library
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight mb-6">
                We pick the game. <span className="text-zinc-500">You just play it.</span>
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                You know the drill: you sit down to play, spend 20 minutes scrolling through your
                library, and end up watching YouTube instead. We fix that.
              </p>
              <p className="text-zinc-500 leading-relaxed">
                Answer three quick questions about your mood, your energy, and how much time you
                have. We&apos;ll surface the right game from your own library.
              </p>
            </div>

            {/* Picker — interactive */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
              <div>
                <p className="text-xs text-zinc-500 mb-3">What do you want to feel?</p>
                <div className="flex gap-2 flex-wrap">
                  {MOODS.map((m) => {
                    const selected = m === mood;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMood(m)}
                        aria-pressed={selected}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          selected
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-3">How much mental energy do you have?</p>
                <div className="flex gap-2 flex-wrap">
                  {ENERGIES.map((e) => {
                    const selected = e === energy;
                    return (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setEnergy(e)}
                        aria-pressed={selected}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          selected
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {e}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-3">Time commitment?</p>
                <div className="flex gap-2 flex-wrap">
                  {TIMES.map((t) => {
                    const selected = t === time;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTime(t)}
                        aria-pressed={selected}
                        className={`px-3 py-1.5 rounded-lg text-xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                          selected
                            ? 'bg-violet-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="h-px bg-zinc-800" />
              <div
                key={pickedGame.title}
                className="flex items-center gap-4 bg-zinc-950 rounded-xl p-4 border border-zinc-800/60 animate-[resultPop_0.35s_ease-out]"
              >
                <Image
                  src={pickedGame.image}
                  alt={pickedGame.title}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 mb-0.5">{pickedGame.title}</p>
                  <p className="text-xs text-zinc-500">{pickedGame.meta}</p>
                </div>
                <div className="text-xs px-3 py-1.5 bg-violet-600 rounded-lg text-white shrink-0">
                  Play this
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-zinc-900" />
        </div>

        {/* ── Section 2: Library ── */}
        <section className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            {/* Library mock */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden order-last lg:order-first">
              <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">My Library</span>
                <span className="text-xs text-zinc-600">
                  <CountUp to={457} /> games
                </span>
              </div>
              <div className="divide-y divide-zinc-800/60">
                {MOCK_LIBRARY.map((game, i) => (
                  <div key={i} className="flex items-center gap-3.5 px-5 py-3.5">
                    <Image
                      src={game.image}
                      alt={game.title}
                      width={36}
                      height={36}
                      className="w-9 h-9 rounded-md object-cover shrink-0"
                    />
                    <span className="text-sm text-zinc-300 flex-1 min-w-0 truncate">
                      {game.title}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full shrink-0 inline-flex items-center gap-1.5 ${game.pill}`}
                    >
                      {game.status === 'Playing' && (
                        <span aria-hidden="true" className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-sky-400" />
                        </span>
                      )}
                      {game.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-violet-400 uppercase tracking-widest mb-4 font-medium">
                Everything in one place
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight mb-6">
                Your backlog, <span className="text-zinc-500">under control.</span>
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Hundreds of games, bought across years of sales. You probably have no idea what you
                actually own anymore.
              </p>
              <p className="text-zinc-500 leading-relaxed">
                MyBacklog pulls your full Steam library and lets you see it all clearly. Mark games
                as playing, finished, dropped, or hidden. Rate the ones you finish, jot down your
                thoughts. Filter and sort however you want. Know exactly what&apos;s waiting for
                you.
              </p>
            </div>
          </div>
        </section>

        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-zinc-900" />
        </div>

        {/* ── Section 3: Momentum ── */}
        <section className="max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            <div>
              <p className="text-xs text-violet-400 uppercase tracking-widest mb-4 font-medium">
                Queue · Diary · Stats
              </p>
              <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 leading-tight mb-6">
                Build momentum. <span className="text-zinc-500">Watch the backlog shrink.</span>
              </h2>
              <p className="text-zinc-400 leading-relaxed mb-4">
                Finishing one game feels good. Finishing ten feels like you&apos;re actually making
                progress. MyBacklog is built to keep that momentum going.
              </p>
              <p className="text-zinc-500 leading-relaxed">
                Queue up what&apos;s next so you never start a session without a plan. Log every
                game you finish, with a rating and notes. Then open Stats and watch your completion
                rate climb. The backlog was always finite. Now you&apos;ll believe it.
              </p>
            </div>

            {/* Momentum mock */}
            <div className="space-y-3">
              {/* Queue */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-700">
                <p className="text-xs text-zinc-600 uppercase tracking-widest mb-3">Up next</p>
                <div className="space-y-2.5">
                  {[
                    { name: 'Disco Elysium', image: '/lp_disco.jpeg' },
                    { name: 'Celeste', image: '/lp_celeste.png' },
                    { name: 'Portal 2', image: '/lp_portal.jpg' },
                  ].map((game, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs text-zinc-700 font-mono w-4 shrink-0">{i + 1}</span>
                      <Image
                        src={game.image}
                        alt={game.name}
                        width={24}
                        height={24}
                        className="w-6 h-6 rounded object-cover shrink-0"
                      />
                      <span className="text-sm text-zinc-400">{game.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Diary entry */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-start gap-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-700">
                <Image
                  src="/lp_hk.jpeg"
                  alt="Hollow Knight"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-zinc-300">Hollow Knight</span>
                    <span className="text-xs text-zinc-600">Jan 2025</span>
                  </div>
                  <div className="flex gap-0.5 mb-1.5">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-600 truncate">
                    One of the best I&apos;ve ever played.
                  </p>
                </div>
              </div>

              {/* Stats callout */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-700">
                <div ref={statsRef} className="flex items-end gap-1 h-10">
                  {[40, 60, 45, 80, 65, 90, 70].map((h, i) => (
                    <div
                      key={i}
                      className={`w-3 bg-violet-500/30 rounded-sm origin-bottom ${
                        statsVisible ? 'animate-[barGrow_0.7s_ease-out_backwards]' : 'scale-y-0'
                      }`}
                      style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }}
                    />
                  ))}
                </div>
                <div>
                  <p className="text-xl font-bold text-zinc-100">
                    <CountUp to={47} trigger={statsVisible} />
                  </p>
                  <p className="text-xs text-zinc-500">games finished this year</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative overflow-hidden border-t border-zinc-900">
          {/* Violet orb — bookend the hero */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
          >
            <div className="w-[700px] h-[420px] bg-violet-600/10 rounded-full blur-3xl animate-[orbBreathe_10s_ease-in-out_infinite]" />
          </div>

          {/* Drifting particles — mirror the hero */}
          <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden">
            {CTA_PARTICLES.map((p, i) => (
              <span
                key={i}
                className="absolute block w-1 h-1 rounded-full bg-violet-300/50"
                style={{
                  left: `${p.left}%`,
                  top: `${p.top}%`,
                  animation: `floatUp ${p.duration}s ease-in-out ${p.delay}s infinite backwards`,
                }}
              />
            ))}
          </div>

          <div className="relative max-w-2xl mx-auto px-6 py-24 md:py-32 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4 leading-tight">
              Start clearing your backlog{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 via-fuchsia-400 to-violet-400 bg-[length:200%_auto] animate-[gradientShimmer_8s_ease-in-out_infinite]">
                tonight
              </span>
            </h2>
            <p className="text-zinc-500 mb-10">
              Free to use. Your Steam library, synced and ready to go.
            </p>
            {user ? (
              <Button
                size="lg"
                onClick={onConnectSteam}
                className="shadow-lg shadow-violet-600/25 transition-all hover:shadow-[0_0_32px_rgba(124,58,237,0.45)] hover:-translate-y-0.5"
              >
                Connect Your Steam
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => openModal('signup')}
                className="shadow-lg shadow-violet-600/25 transition-all hover:shadow-[0_0_32px_rgba(124,58,237,0.45)] hover:-translate-y-0.5"
              >
                Get Started
              </Button>
            )}
          </div>
        </section>
      </main>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}

function CountUp({
  to,
  durationMs = 1400,
  trigger,
}: {
  to: number;
  durationMs?: number;
  trigger?: boolean;
}) {
  const [value, setValue] = useState(0);
  const nodeRef = useRef<HTMLSpanElement | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;

    const start = () => {
      if (started.current) return;
      started.current = true;
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / durationMs);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(to * eased));
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    if (trigger !== undefined) {
      if (trigger) start();
      return;
    }

    const el = nodeRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          start();
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [to, durationMs, trigger]);

  return <span ref={nodeRef}>{value.toLocaleString()}</span>;
}
