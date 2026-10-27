import { act, render } from '@testing-library/react';
import { ArtShuffle } from '@/components/games/ArtShuffle';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src }: { src: string }) => <img alt="" src={src} />,
}));

const covers = Array.from({ length: 16 }, (_, i) => `https://${i}.jpg`);
const showing = (container: HTMLElement) =>
  container.querySelector('.opacity-100 img')?.getAttribute('src');

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('winds down over its duration: fast at first, slow by the end', () => {
  const { container } = render(
    <div className="relative">
      <ArtShuffle covers={covers} sizes="512px" duration={2200} />
    </div>,
  );
  // How many times the art changes in a stretch of time.
  const changesIn = (ms: number) => {
    let changes = 0;
    for (let t = 0; t < ms; t += 10) {
      const before = showing(container);
      act(() => jest.advanceTimersByTime(10));
      if (showing(container) !== before) changes++;
    }
    return changes;
  };
  const early = changesIn(500);
  act(() => jest.advanceTimersByTime(1200));
  const late = changesIn(500);
  expect(early).toBeGreaterThanOrEqual(5);
  expect(late).toBeLessThanOrEqual(2);
});
