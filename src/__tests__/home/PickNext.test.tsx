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
