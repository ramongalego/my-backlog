import { fireEvent, render } from '@testing-library/react';
import { GameArt } from '@/components/games/GameArt';

// The app's resized picture, or (unoptimized) the file itself.
jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    unoptimized,
    onLoad,
    onError,
    className,
  }: {
    src: string;
    alt: string;
    unoptimized?: boolean;
    onLoad?: () => void;
    onError?: () => void;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      data-direct={unoptimized ? 'yes' : 'no'}
      className={className}
      onLoad={onLoad}
      onError={onError}
    />
  ),
}));

const WIDE = 'https://cdn2.steamgriddb.com/grid/aef88b80.png';
// Tall box art: drawn whole, over a blurred copy of itself.
const BOX = 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1abc.jpg';
const onSettled = jest.fn();
const art = (container: HTMLElement) =>
  container.querySelector('img.object-cover:not(.blur-xl), img.object-contain') as HTMLImageElement;

beforeEach(() => jest.clearAllMocks());

it('says when the art has loaded', () => {
  const { container } = render(<GameArt src={WIDE} alt="" sizes="180px" onSettled={onSettled} />);
  expect(art(container)).toHaveAttribute('data-direct', 'no');
  fireEvent.load(art(container));
  expect(onSettled).toHaveBeenCalledTimes(1);
});

it('asks again for art that fails, then for the file itself, before giving up', () => {
  const { container } = render(<GameArt src={WIDE} alt="" sizes="180px" onSettled={onSettled} />);
  const first = art(container);

  // Once more the usual way, as a new image: a failed one doesn't load again in place.
  fireEvent.error(first);
  const second = art(container);
  expect(second).not.toBe(first);
  expect(second).toHaveAttribute('data-direct', 'no');
  expect(onSettled).not.toHaveBeenCalled();

  // Then straight from where it's kept.
  fireEvent.error(second);
  const third = art(container);
  expect(third).not.toBe(second);
  expect(third).toHaveAttribute('data-direct', 'yes');
  expect(third).toHaveAttribute('src', WIDE);
  expect(onSettled).not.toHaveBeenCalled();

  // That failing too is the end of it: whoever was waiting can stop.
  fireEvent.error(third);
  expect(art(container)).toBe(third);
  expect(onSettled).toHaveBeenCalledTimes(1);
});

it('stops asking as soon as a try loads', () => {
  const { container } = render(<GameArt src={WIDE} alt="" sizes="180px" onSettled={onSettled} />);
  fireEvent.error(art(container));
  const second = art(container);
  fireEvent.load(second);
  expect(onSettled).toHaveBeenCalledTimes(1);
  expect(art(container)).toBe(second);
});

it('swaps to a new picture in place, so the one that is there stays until it has loaded', () => {
  const { container, rerender } = render(<GameArt src={WIDE} alt="" sizes="180px" />);
  const shown = art(container);
  rerender(<GameArt src="https://cdn2.steamgriddb.com/grid/other.png" alt="" sizes="180px" />);
  // The same image, pointed at the new file: not a new, empty one.
  expect(art(container)).toBe(shown);
  expect(art(container)).toHaveAttribute('src', 'https://cdn2.steamgriddb.com/grid/other.png');
});

it('gives a new picture its tries afresh', () => {
  const { container, rerender } = render(<GameArt src={WIDE} alt="" sizes="180px" />);
  fireEvent.error(art(container));
  fireEvent.error(art(container));
  expect(art(container)).toHaveAttribute('data-direct', 'yes');

  rerender(<GameArt src="https://cdn2.steamgriddb.com/grid/other.png" alt="" sizes="180px" />);
  expect(art(container)).toHaveAttribute('data-direct', 'no');
});

it('retries tall box art and the blurred copy behind it together', () => {
  const { container } = render(<GameArt src={BOX} alt="Hades" sizes="180px" />);
  expect(container.querySelectorAll('img')).toHaveLength(2);
  fireEvent.error(art(container));
  fireEvent.error(art(container));
  const [blur, top] = [...container.querySelectorAll('img')];
  expect(blur).toHaveClass('blur-xl');
  expect(blur).toHaveAttribute('data-direct', 'yes');
  expect(top).toHaveAttribute('data-direct', 'yes');
  expect(top).toHaveAttribute('alt', 'Hades');
});
