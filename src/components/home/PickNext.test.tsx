import { fireEvent, render, screen } from '@testing-library/react';
import { PickNext, wallCovers } from '@/components/home/PickNext';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const art = (...names: (string | null)[]) => names.map((header_image) => ({ header_image }));

describe('wallCovers', () => {
  it('takes a game from each row in turn, once each, skipping ones without art', () => {
    expect(wallCovers([art('a1', 'a2', 'a3'), art(null, 'b2'), art('a1', 'c2')])).toEqual([
      'a1',
      'a2',
      'b2',
      'c2',
      'a3',
    ]);
  });

  it('stops at sixteen', () => {
    const row = art(...Array.from({ length: 30 }, (_, i) => `g${i}`));
    expect(wallCovers([row])).toHaveLength(16);
  });
});

describe('PickNext', () => {
  it('counts the backlog and offers both ways to pick', () => {
    const onPick = jest.fn();
    const onRandom = jest.fn();
    render(<PickNext covers={['a']} backlogCount={1} onPick={onPick} onRandom={onRandom} />);

    expect(screen.getByRole('heading', { name: 'What are you playing next?' })).toBeInTheDocument();
    expect(screen.getByText('game waiting in your backlog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pick My Game' }));
    fireEvent.click(screen.getByRole('button', { name: 'Random' }));
    expect(onPick).toHaveBeenCalled();
    expect(onRandom).toHaveBeenCalled();
  });
});

describe('PickNext with the AI features turned off', () => {
  it('offers a random pick as the one thing to do, from the button and from the wall', () => {
    const onRandom = jest.fn();
    const { container } = render(<PickNext covers={['a']} backlogCount={12} onRandom={onRandom} />);

    expect(screen.queryByRole('button', { name: 'Pick My Game' })).not.toBeInTheDocument();
    expect(screen.queryByText(/how you want to feel/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Leave it to chance: MyBacklog picks one from your backlog at random'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pick a random game' }));
    expect(onRandom).toHaveBeenCalledTimes(1);
    // The wall of art does what the button beside it does.
    fireEvent.click(container.querySelector('button[aria-hidden="true"]')!);
    expect(onRandom).toHaveBeenCalledTimes(2);
  });
});

describe('PickNext with games in the queue', () => {
  it('says both picks leave the queue out', () => {
    render(
      <PickNext
        covers={['a']}
        backlogCount={12}
        onPick={jest.fn()}
        onRandom={jest.fn()}
        someQueued
      />,
    );
    expect(
      screen.getByText(/Or leave it to chance\. Games in your queue are left out\.$/),
    ).toBeInTheDocument();
  });

  it('says a random pick leaves the queue out, with the AI features off', () => {
    render(<PickNext covers={['a']} backlogCount={12} onRandom={jest.fn()} someQueued />);
    expect(
      screen.getByText(
        'Leave it to chance: MyBacklog picks one from your backlog at random, leaving out your queue',
      ),
    ).toBeInTheDocument();
  });

  it("doesn't mention the queue when nothing is in it", () => {
    render(<PickNext covers={['a']} backlogCount={12} onPick={jest.fn()} onRandom={jest.fn()} />);
    expect(screen.queryByText(/queue/)).not.toBeInTheDocument();
  });
});
