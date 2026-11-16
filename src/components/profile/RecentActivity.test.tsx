import { render, screen, within } from '@testing-library/react';
import { RecentActivity } from '@/components/profile/RecentActivity';
import { activityDay, type ActivityEntry } from '@/lib/account/activity';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const entry = (overrides: Partial<ActivityEntry>): ActivityEntry => ({
  id: 1,
  kind: 'finished',
  name: 'Test Game',
  header_image: null,
  source: 'steam',
  platform: 'PC',
  day: '2026-10-19',
  rating: null,
  ...overrides,
});

const rows = () =>
  within(screen.getByRole('region', { name: 'Recent activity' })).getAllByRole('listitem');

it('says what happened to each game, when, and where it was played', () => {
  render(
    <RecentActivity
      entries={[
        entry({
          id: 1,
          kind: 'playing',
          name: 'Ocarina of Time',
          source: 'manual',
          platform: 'Switch 2',
          day: '2026-11-13',
        }),
        entry({
          id: 2,
          name: "Fire Emblem: Fortune's Weave",
          source: 'manual',
          platform: 'Switch 2',
          rating: 9,
        }),
        entry({ id: 3, kind: 'dropped', name: 'Super Meat Boy', day: '2026-04-11' }),
      ]}
    />,
  );
  const [playing, finished, dropped] = rows();
  expect(playing).toHaveTextContent(
    `Ocarina of TimePlaying since ${activityDay('2026-11-13')} on Switch 2`,
  );
  expect(finished).toHaveTextContent(
    `Fire Emblem: Fortune's WeaveFinished ${activityDay('2026-10-19')} on Switch 29/10`,
  );
  // A Steam game played on Steam names no platform, as on its card.
  expect(dropped).toHaveTextContent(`Super Meat BoyDropped ${activityDay('2026-04-11')}`);
  expect(dropped).not.toHaveTextContent(' on ');
});

it('colors each by its status, as everywhere else', () => {
  render(
    <RecentActivity
      entries={[
        entry({ id: 1, kind: 'playing' }),
        entry({ id: 2, kind: 'finished' }),
        entry({ id: 3, kind: 'dropped' }),
      ]}
    />,
  );
  expect(screen.getByText('Playing')).toHaveClass('text-accent-400');
  expect(screen.getByText('Finished')).toHaveClass('text-emerald-400');
  expect(screen.getByText('Dropped')).toHaveClass('text-rose-400');
});

it('shows a game being played without a day when its start is not known', () => {
  render(<RecentActivity entries={[entry({ kind: 'playing', day: null })]} />);
  expect(rows()[0]).toHaveTextContent('Test GamePlaying');
  expect(rows()[0]).not.toHaveTextContent('since');
});

it('leads on to the Diary', () => {
  render(<RecentActivity entries={[entry({})]} />);
  expect(screen.getByRole('link', { name: 'Diary' })).toHaveAttribute('href', '/diary');
});

it('says what will show up when there is nothing yet', () => {
  render(<RecentActivity entries={[]} />);
  expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Diary' })).not.toBeInTheDocument();
});
