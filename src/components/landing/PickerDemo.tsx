'use client';

import { useEffect, useState } from 'react';
import Image, { getImageProps } from 'next/image';
import { Clock, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { ToggleGroup } from '@/components/ui/ToggleGroup';
import { useInView } from '@/hooks/useInView';
import {
  ENERGIES,
  MOODS,
  PICKER_GAMES,
  TIMES,
  TIME_HINTS,
  pickGame,
  type Energy,
  type Mood,
  type Time,
} from './picker-games';
import { riseIn } from './motion';
import { SectionCopy } from './SectionCopy';

/** The three questions, answered on the page: a sample pick for each answer. */
export function PickerDemo({ onSignUp }: { onSignUp: () => void }) {
  const [mood, setMood] = useState<Mood>('Adrenaline');
  const [energy, setEnergy] = useState<Energy>('High');
  const [time, setTime] = useState<Time>('Long haul');
  const pickedGame = pickGame(mood, energy, time);
  // The questions settle in one by one as they scroll into view.
  const { ref: pickerRef, inView: pickerInView } = useInView<HTMLDivElement>();

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

  return (
    <section className="border-t border-ink-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-24 items-center">
        <SectionCopy title="Pick tonight's game in three questions">
          <p>
            You sit down to play, scroll through your library for 20 minutes, and end up watching
            YouTube instead.
          </p>
          <p>
            Say how you want to feel, how much energy you have and how long you can play, and
            MyBacklog picks a game you already own. Try it:
          </p>
        </SectionCopy>

        <Panel className="space-y-5">
          <div
            ref={pickerRef}
            className={riseIn(pickerInView, 0).className}
            style={riseIn(pickerInView, 0).style}
          >
            <p className="text-sm text-ink-300 mb-2.5">What do you want to feel?</p>
            <ToggleGroup
              label="What do you want to feel?"
              value={mood}
              onChange={setMood}
              options={MOODS.map((v) => ({ value: v, label: v }))}
            />
          </div>
          <div className={riseIn(pickerInView, 1).className} style={riseIn(pickerInView, 1).style}>
            <p className="text-sm text-ink-300 mb-2.5">How much mental energy do you have?</p>
            <ToggleGroup
              label="How much mental energy do you have?"
              value={energy}
              onChange={setEnergy}
              options={ENERGIES.map((v) => ({ value: v, label: v }))}
            />
          </div>
          <div className={riseIn(pickerInView, 2).className} style={riseIn(pickerInView, 2).style}>
            <p className="text-sm text-ink-300 mb-2.5">How much time do you have?</p>
            <ToggleGroup
              label="How much time do you have?"
              value={time}
              onChange={setTime}
              options={TIMES.map((v) => ({ value: v, label: v }))}
            />
            <p className="mt-2 text-xs text-ink-500">{TIME_HINTS[time]}</p>
          </div>
          {/* The pick settles in last; each new pick then pops in on its own. */}
          <div className={riseIn(pickerInView, 3).className} style={riseIn(pickerInView, 3).style}>
            {/* Screen readers hear each new pick from this, which stays put: the
                card below is replaced on every pick, and a region that's just been
                added often isn't read out. */}
            <p className="sr-only" aria-live="polite">
              {`Picked ${pickedGame.title}: about ${pickedGame.hours} hours to beat, critic score ${pickedGame.critic}`}
            </p>
            <div
              key={pickedGame.title}
              className="flex items-center gap-4 border-t border-ink-800 pt-5 animate-[resultPop_0.3s_ease-out] motion-reduce:animate-none"
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
                {/* As the app shows them: each fact with its icon, no separator to
                    strand at a line's end when a phone wraps them. */}
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-ink-400">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />~{pickedGame.hours}h to beat
                  </span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <ThumbsUp className="w-3.5 h-3.5" aria-hidden="true" />
                    {pickedGame.critic} critic score
                  </span>
                </p>
              </div>
              {/* The demo's pick leads to signing up, where it's your own library. */}
              <Button
                size="sm"
                className="shrink-0 cursor-pointer"
                aria-haspopup="dialog"
                onClick={onSignUp}
              >
                Play this
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </section>
  );
}
