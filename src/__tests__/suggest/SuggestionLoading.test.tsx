import { act, render } from '@testing-library/react';
import { SuggestionLoading } from '@/components/suggest/SuggestionLoading';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src }: { src: string }) => <img alt="" src={src} />,
}));

// Which art is showing: the one layer that isn't faded out.
const showing = (container: HTMLElement) =>
  [...container.querySelectorAll('.opacity-100 img')].map((img) => img.getAttribute('src'));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('flicks through backlog art while the game is picked', () => {
  const { container, getByText } = render(
    <SuggestionLoading covers={['https://a.jpg', 'https://b.jpg', 'https://c.jpg']} />,
  );
  expect(getByText('Picking a game from your backlog…')).toBeInTheDocument();
  expect(showing(container)).toEqual(['https://a.jpg']);
  act(() => jest.advanceTimersByTime(130));
  expect(showing(container)).toEqual(['https://b.jpg']);
  act(() => jest.advanceTimersByTime(260));
  expect(showing(container)).toEqual(['https://a.jpg']);
});

it('shows a spinner when there is no art to flick through', () => {
  const { container, getByText } = render(<SuggestionLoading covers={['https://a.jpg']} />);
  expect(getByText('Picking a game from your backlog…')).toBeInTheDocument();
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('.animate-spin')).not.toBeNull();
});
