import { fireEvent, render, screen } from '@testing-library/react';
import { GamesPlatform } from '@/components/games/GamesPlatform';

const options = [
  { value: 'PC', count: 151 },
  { value: 'Switch 2', count: 19 },
  { value: 'N64', count: 1 },
];

const onGone = jest.fn();
const state = (value: string, set = jest.fn()) => ({ value, set, options, allCount: 171 });

function open(value = '') {
  const onChange = jest.fn();
  render(<GamesPlatform platforms={state(value, onChange)} onGone={onGone} />);
  return onChange;
}

beforeEach(() => onGone.mockClear());

it('is a menu named for what it lists, quiet while it lists everything', () => {
  open();
  const trigger = screen.getByRole('button', { name: 'Platform: All platforms' });
  expect(trigger).toHaveClass('bg-ink-800', 'text-ink-300');
  expect(trigger).not.toHaveClass('bg-ink-100');
  // The label is there for screen readers on phones, where only the icon shows.
  expect(screen.getByText('All platforms')).toHaveClass('sr-only', 'md:not-sr-only');
});

it('offers every platform after All, each with how many games it would list', () => {
  open();
  fireEvent.click(screen.getByRole('button', { name: 'Platform: All platforms' }));

  expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
    'All platforms 171 games',
    'PC 151 games',
    'Switch 2 19 games',
    'N64 1 game',
  ]);
  expect(screen.getByRole('option', { name: 'All platforms 171 games' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
});

it('picks a platform, and is lit like a chosen chip while one is picked', () => {
  const onChange = open();
  fireEvent.click(screen.getByRole('button', { name: 'Platform: All platforms' }));
  fireEvent.click(screen.getByRole('option', { name: 'Switch 2 19 games' }));
  expect(onChange).toHaveBeenCalledWith('Switch 2');
});

it('names the platform it is narrowing to, and goes back to all of them', () => {
  const onChange = open('Switch 2');
  const trigger = screen.getByRole('button', { name: 'Platform: Switch 2' });
  expect(trigger).toHaveClass('bg-ink-100', 'text-ink-950');
  expect(trigger).not.toHaveClass('text-ink-300');

  fireEvent.click(trigger);
  expect(screen.getByRole('option', { name: 'Switch 2 19 games' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  fireEvent.click(screen.getByRole('option', { name: 'All platforms 171 games' }));
  expect(onChange).toHaveBeenCalledWith('');
});

describe('when there is nothing to choose between', () => {
  it('draws nothing', () => {
    const { container } = render(<GamesPlatform platforms={null} onGone={onGone} />);
    expect(container).toBeEmptyDOMElement();
    expect(onGone).not.toHaveBeenCalled();
  });

  it('hands focus on when it leaves the page while it has it', () => {
    // PC chosen under Dropped, where every game is on PC; then "All platforms".
    const { rerender } = render(<GamesPlatform platforms={state('PC')} onGone={onGone} />);
    screen.getByRole('button', { name: 'Platform: PC' }).focus();

    rerender(<GamesPlatform platforms={null} onGone={onGone} />);
    expect(onGone).toHaveBeenCalledTimes(1);
  });

  it("leaves focus alone when it's somewhere else (a status chip was clicked)", () => {
    const { rerender } = render(
      <>
        <button>Dropped</button>
        <GamesPlatform platforms={state('')} onGone={onGone} />
      </>,
    );
    screen.getByRole('button', { name: 'Dropped' }).focus();

    rerender(
      <>
        <button>Dropped</button>
        <GamesPlatform platforms={null} onGone={onGone} />
      </>,
    );
    expect(onGone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Dropped' })).toHaveFocus();
  });

  it('comes back without moving focus', () => {
    const { rerender } = render(<GamesPlatform platforms={null} onGone={onGone} />);
    rerender(<GamesPlatform platforms={state('')} onGone={onGone} />);
    expect(screen.getByRole('button', { name: 'Platform: All platforms' })).toBeInTheDocument();
    expect(onGone).not.toHaveBeenCalled();
  });
});
