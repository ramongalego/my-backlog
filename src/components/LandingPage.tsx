'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import Image from 'next/image';
import { Header } from '@/components/Header';
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

export function LandingPage({ user, onConnectSteam }: LandingPageProps) {
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  const openModal = (mode: AuthMode) => {
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <Header />

      <main className="pt-16 flex-1">
        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[900px] h-[600px] bg-violet-600/8 rounded-full blur-3xl" />
          </div>

          <div className="relative max-w-4xl mx-auto px-6 py-32 md:py-48 text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-zinc-100 leading-[1.1] tracking-tight mb-6">
              Stop scrolling.{' '}
              <span className="text-transparent bg-clip-text bg-linear-to-r from-violet-400 to-fuchsia-400">
                Start playing.
              </span>
            </h1>
            <p className="text-xl text-zinc-400 mb-12 max-w-lg mx-auto leading-relaxed">
              Your Steam library has hundreds of games. We help you actually play them, and finish
              them.
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

            {/* Picker mock */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
              <div>
                <p className="text-xs text-zinc-500 mb-3">What do you want to feel?</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1.5 bg-violet-600 rounded-lg text-xs text-white">
                    Adrenaline
                  </span>
                  <span className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                    Relaxed
                  </span>
                  <span className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                    Engaged
                  </span>
                  <span className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                    Emotional
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-3">How much mental energy do you have?</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1.5 bg-violet-600 rounded-lg text-xs text-white">
                    High
                  </span>
                  <span className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                    Medium
                  </span>
                  <span className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                    Low
                  </span>
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-3">Time commitment?</p>
                <div className="flex gap-2 flex-wrap">
                  <span className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                    One session
                  </span>
                  <span className="px-3 py-1.5 bg-violet-600 rounded-lg text-xs text-white">
                    A few nights
                  </span>
                  <span className="px-3 py-1.5 bg-zinc-800 rounded-lg text-xs text-zinc-400">
                    Long haul
                  </span>
                </div>
              </div>
              <div className="h-px bg-zinc-800" />
              <div className="flex items-center gap-4 bg-zinc-950 rounded-xl p-4 border border-zinc-800/60">
                <Image
                  src="/lp_hk.jpeg"
                  alt="Hollow Knight"
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-lg object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-100 mb-0.5">Hollow Knight</p>
                  <p className="text-xs text-zinc-500">~27h to beat · 9.8 rating</p>
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
                <span className="text-xs text-zinc-600">847 games</span>
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
                    <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${game.pill}`}>
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
                thoughts. Filter and sort however you want. Know exactly what&apos;s waiting for you.
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
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
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-start gap-4">
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
                    {[1, 2, 3, 4].map((i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                    ))}
                    <Star className="w-3 h-3 text-zinc-700" />
                  </div>
                  <p className="text-xs text-zinc-600 truncate">
                    One of the best I&apos;ve ever played.
                  </p>
                </div>
              </div>

              {/* Stats callout */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 flex items-center gap-5">
                <div className="flex items-end gap-1 h-10">
                  {[40, 60, 45, 80, 65, 90, 70].map((h, i) => (
                    <div
                      key={i}
                      className="w-3 bg-violet-500/30 rounded-sm"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
                <div>
                  <p className="text-xl font-bold text-zinc-100">47</p>
                  <p className="text-xs text-zinc-500">games finished this year</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="border-t border-zinc-900">
          <div className="max-w-2xl mx-auto px-6 py-24 md:py-32 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-zinc-100 mb-4">
              Start clearing your backlog tonight.
            </h2>
            <p className="text-zinc-500 mb-10">
              Free to use. Connect your Steam library in under a minute.
            </p>
            {user ? (
              <Button size="lg" onClick={onConnectSteam}>
                Connect Your Steam
              </Button>
            ) : (
              <Button size="lg" onClick={() => openModal('signup')}>
                Get Started
              </Button>
            )}
          </div>
        </section>
      </main>

      <footer className="py-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <p className="text-sm text-zinc-600">MyBacklog</p>
        </div>
      </footer>

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authMode}
      />
    </div>
  );
}
