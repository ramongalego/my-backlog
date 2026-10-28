import { act, fireEvent, render, screen } from '@testing-library/react';
import { SuggestionWizard } from '@/components/suggest/SuggestionWizard';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function setup(props: Partial<Parameters<typeof SuggestionWizard>[0]> = {}) {
  const handlers = {
    onSelectMood: jest.fn(),
    onSelectEnergy: jest.fn(),
    onSelectTime: jest.fn(),
    onBack: jest.fn(),
  };
  render(<SuggestionWizard step="mood" {...handlers} {...props} />);
  return handlers;
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('shows the chosen answer for a moment before moving on', () => {
  const { onSelectMood } = setup();
  const relaxed = screen.getByRole('button', { name: /Relaxed/ });
  fireEvent.click(relaxed);
  expect(relaxed).toHaveClass('bg-ink-100');
  expect(onSelectMood).not.toHaveBeenCalled();

  // A second click while it shows doesn't answer twice.
  fireEvent.click(screen.getByRole('button', { name: /Engaged/ }));
  act(() => jest.advanceTimersByTime(180));
  expect(onSelectMood).toHaveBeenCalledTimes(1);
  expect(onSelectMood).toHaveBeenCalledWith('relaxed');
});

it('answers with the number keys', () => {
  const { onSelectTime } = setup({ step: 'time', answers: { mood: 'relaxed', energy: 'low' } });
  fireEvent.keyDown(window, { key: '3' });
  act(() => jest.advanceTimersByTime(180));
  expect(onSelectTime).toHaveBeenCalledWith('long');

  // Keys past the last answer, or with a modifier, do nothing.
  fireEvent.keyDown(window, { key: '4' });
  fireEvent.keyDown(window, { key: '1', ctrlKey: true });
  act(() => jest.advanceTimersByTime(180));
  expect(onSelectTime).toHaveBeenCalledTimes(1);
});

it('names the question for its answers and focuses them', () => {
  setup({ step: 'energy', answers: { mood: 'relaxed' } });
  const group = screen.getByRole('group', { name: 'How much mental energy do you have?' });
  expect(group).toHaveFocus();
});

it('trails the answers so far, not ones from after going back', () => {
  setup({ step: 'energy', answers: { mood: 'relaxed', energy: 'high' } });
  expect(screen.getByText('Relaxed')).toBeInTheDocument();
  expect(screen.queryByText(/High energy/)).not.toBeInTheDocument();
  expect(screen.getByText('Question 2 of 3')).toBeInTheDocument();
});

it('goes back from a later question, not the first', () => {
  const { onBack } = setup({ step: 'time', answers: { mood: 'relaxed', energy: 'high' } });
  expect(screen.getByText('Relaxed · High energy')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalled();
});

it('has no Back on the first question', () => {
  setup();
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
});
