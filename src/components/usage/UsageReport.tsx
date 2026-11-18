import type { ReactNode } from 'react';
import { Panel } from '@/components/ui/Panel';
import { SectionLabel } from '@/components/layout/Page';
import { ENERGY_QUESTION, MOOD_QUESTION, TIME_QUESTION } from '@/lib/suggest/questions';
import type { Usage } from '@/lib/usage';

const WEEK = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function share(part: number, whole: number): string | undefined {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : undefined;
}

function Figure({ value, label, note }: { value: number; label: string; note?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-semibold tracking-tight text-ink-50">{value}</p>
      <p className="text-sm text-ink-400">
        {label}
        {note && <span className="text-ink-500"> {note}</span>}
      </p>
    </div>
  );
}

function Strip({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Panel>
      <SectionLabel>{title}</SectionLabel>
      {hint && <p className="mt-1 text-xs text-ink-500">{hint}</p>}
      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">{children}</div>
    </Panel>
  );
}

/** The answers given most to one question, by the words the picker shows. */
function TopAnswers({
  question,
  answers,
}: {
  question: { title: string; options: { value: string; label: string; short?: string }[] };
  answers: Usage['pickMyGame']['moods'];
}) {
  const name = (value: string) => {
    const option = question.options.find((o) => o.value === value);
    return option?.short ?? option?.label ?? value;
  };
  return (
    <div className="flex flex-wrap gap-x-2 text-sm">
      <span className="text-ink-400">{question.title}</span>
      <span className="text-ink-100">
        {answers.length > 0
          ? answers.map((a) => `${name(a.answer)} ${a.picks}`).join(', ')
          : 'No answers yet'}
      </span>
    </div>
  );
}

/** The owner's view of how many people use the app: counts only. */
export function UsageReport({ usage }: { usage: Usage }) {
  const { players, month, signups, libraries, features, pickMyGame } = usage;
  const ofPlayers = (n: number) => share(n, players);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Strip title="Players">
        <Figure value={players} label="Accounts" />
        <Figure
          value={usage.steamConnected}
          label="Connected Steam"
          note={share(usage.steamConnected, players)}
        />
        <Figure value={usage.withGames} label="Have games" note={share(usage.withGames, players)} />
        <Figure
          value={usage.cameBack}
          label="Came back after day one"
          note={share(usage.cameBack, players)}
        />
      </Strip>

      <Strip
        title="Active"
        hint="Changed a game, got a pick, wrote a profile or roast, or had the app open"
      >
        <Figure value={usage.activeDay} label="Last 24 hours" />
        <Figure value={usage.activeWeek} label="Last 7 days" />
        <Figure value={usage.activeMonth} label="Last 30 days" />
      </Strip>

      <Strip title="Sign-ups" hint="How players sign in: an account can have more than one way">
        <Figure value={signups.email} label="Email" note={ofPlayers(signups.email)} />
        <Figure value={signups.google} label="Google" note={ofPlayers(signups.google)} />
        <Figure value={signups.discord} label="Discord" note={ofPlayers(signups.discord)} />
        <Figure
          value={signups.unconfirmed}
          label="Never confirmed their email"
          note={ofPlayers(signups.unconfirmed)}
        />
      </Strip>

      <Strip title="Libraries" hint="Not counting hidden games, or Steam's tools and soundtracks">
        <Figure value={libraries.medianGames} label="Games in a typical library" />
        <Figure value={libraries.steamGames} label="Steam games" />
        <Figure value={libraries.manualGames} label="Games added by hand" />
        <Figure
          value={libraries.manualOnly}
          label="Players with no Steam games"
          note={share(libraries.manualOnly, usage.withGames)}
        />
      </Strip>

      <Strip title="Last 30 days">
        <Figure value={month.picks} label="Picks" note={`${month.picksTaken} taken`} />
        <Figure value={month.pickers} label="Players who got a pick" />
        <Figure value={month.finishes} label="Finishes" note={`by ${month.finishers}`} />
        <Figure value={month.insightWriters} label="Wrote a profile or roast" />
        <Figure value={month.supportTickets} label="Reports sent" />
      </Strip>

      <Panel>
        <SectionLabel>Pick My Game</SectionLabel>
        <p className="mt-1 text-xs text-ink-500">The last 30 days</p>
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
          <Figure value={pickMyGame.questions} label="From the questions" />
          <Figure value={pickMyGame.random} label="At random" />
          <Figure value={pickMyGame.played} label="Started" />
          <Figure value={pickMyGame.queued} label="Queued" />
          <Figure value={pickMyGame.rerolled} label="Rolled again" />
          <Figure value={pickMyGame.closed} label="Closed without choosing" />
        </div>
        <div className="mt-6 space-y-2">
          <TopAnswers question={MOOD_QUESTION} answers={pickMyGame.moods} />
          <TopAnswers question={ENERGY_QUESTION} answers={pickMyGame.energies} />
          <TopAnswers question={TIME_QUESTION} answers={pickMyGame.times} />
        </div>
      </Panel>

      <Strip title="Features used" hint="Players who have ever used each">
        <Figure value={features.queue} label="Queue" note={ofPlayers(features.queue)} />
        <Figure value={features.favorites} label="Favorites" note={ofPlayers(features.favorites)} />
        <Figure value={features.ratings} label="Ratings" note={ofPlayers(features.ratings)} />
        <Figure value={features.notes} label="Notes" note={ofPlayers(features.notes)} />
        <Figure
          value={features.addedByHand}
          label="Added a game by hand"
          note={ofPlayers(features.addedByHand)}
        />
        <Figure value={features.chosenArt} label="Chose art" note={ofPlayers(features.chosenArt)} />
        <Figure
          value={features.shareCards}
          label="Shared a finish"
          note={ofPlayers(features.shareCards)}
        />
        <Figure
          value={features.nameOrPicture}
          label="Set a name or picture"
          note={ofPlayers(features.nameOrPicture)}
        />
        <Figure value={features.profile} label="Profile" note={ofPlayers(features.profile)} />
        <Figure value={features.roast} label="Roast" note={ofPlayers(features.roast)} />
      </Strip>

      <Panel>
        <SectionLabel>By week</SectionLabel>
        <p className="mt-1 text-xs text-ink-500">Weeks start on Monday, UTC</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-500">
              <th scope="col" className="pb-2 font-normal">
                Week
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                New
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Active
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Picks
              </th>
              <th scope="col" className="pb-2 text-right font-normal">
                Finishes
              </th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {usage.weeks.map((week, i) => (
              <tr key={week.start} className="border-t border-ink-800">
                <th scope="row" className="py-2 text-left font-normal text-ink-400">
                  {i === 0 ? 'This week' : WEEK.format(new Date(week.start))}
                </th>
                <td className="py-2 text-right text-ink-100">{week.signups}</td>
                <td className="py-2 text-right text-ink-100">{week.active}</td>
                <td className="py-2 text-right text-ink-100">{week.picks}</td>
                <td className="py-2 text-right text-ink-100">{week.finishes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
