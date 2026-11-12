import { fireEvent, render, screen } from '@testing-library/react';
import { GamesSort } from '@/components/games/GamesSort';

const setup = (props: Partial<Parameters<typeof GamesSort>[0]> = {}) => {
  const onChange = jest.fn();
  const onReverse = jest.fn();
  render(
    <GamesSort
      value="score"
      onChange={onChange}
      reversed={false}
      onReverse={onReverse}
      {...props}
    />,
  );
  return { onChange, onReverse };
};

it('says which way the games run, and reverses them', () => {
  const { onReverse } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Highest first. Reverse the order' }));
  expect(onReverse).toHaveBeenCalled();
});

it.each([
  ['length', false, 'Shortest first'],
  ['length', true, 'Longest first'],
  ['released', false, 'Newest first'],
  ['recent', true, 'Oldest first'],
  ['playtime', true, 'Least first'],
] as const)('reads %s (reversed: %s) as "%s"', (value, reversed, order) => {
  setup({ value, reversed });
  expect(screen.getByRole('button', { name: `${order}. Reverse the order` })).toBeInTheDocument();
});
