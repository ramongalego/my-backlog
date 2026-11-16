import { fireEvent, render, screen } from '@testing-library/react';
import { TruncatedText } from '@/components/ui/TruncatedText';

const NAME = 'The Legend of Heroes: Trails of Cold Steel III';

/** Lays the text out as cut (or not): jsdom lays nothing out itself. */
function sized(element: HTMLElement, { cut }: { cut: boolean }) {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: 120 });
  Object.defineProperty(element, 'scrollWidth', { configurable: true, value: cut ? 300 : 120 });
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 20 });
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 20 });
}
const bubble = () => document.body.querySelector('[aria-hidden="true"].fixed');

it('shows the whole name the moment the pointer is on it, when it is cut', () => {
  render(<TruncatedText className="truncate">{NAME}</TruncatedText>);
  const text = screen.getByText(NAME);
  sized(text, { cut: true });

  fireEvent.mouseEnter(text);
  expect(bubble()).toHaveTextContent(NAME);

  fireEvent.mouseLeave(text);
  expect(bubble()).not.toBeInTheDocument();
});

it('shows nothing for a name that fits', () => {
  render(<TruncatedText className="truncate">Hades</TruncatedText>);
  const text = screen.getByText('Hades');
  sized(text, { cut: false });
  fireEvent.mouseEnter(text);
  expect(bubble()).not.toBeInTheDocument();
});

it('counts a name clamped to its lines as cut too', () => {
  render(<TruncatedText className="line-clamp-2">{NAME}</TruncatedText>);
  const text = screen.getByText(NAME);
  sized(text, { cut: false });
  Object.defineProperty(text, 'scrollHeight', { configurable: true, value: 60 });
  fireEvent.mouseEnter(text);
  expect(bubble()).toHaveTextContent(NAME);
});

it('goes away when the page scrolls, since it would drift from the name', () => {
  render(<TruncatedText className="truncate">{NAME}</TruncatedText>);
  const text = screen.getByText(NAME);
  sized(text, { cut: true });
  fireEvent.mouseEnter(text);
  fireEvent.scroll(window);
  expect(bubble()).not.toBeInTheDocument();
});

it('keeps the name as plain text for a screen reader, with no title attribute', () => {
  render(
    <TruncatedText as="p" className="truncate">
      {NAME}
    </TruncatedText>,
  );
  const text = screen.getByText(NAME);
  expect(text.tagName).toBe('P');
  expect(text).not.toHaveAttribute('title');
});

it('shows nothing for a tap: a touchscreen sends mouse events too, and the bubble would stay', () => {
  window.matchMedia = ((query: string) => ({
    matches: query === '(hover: none)',
  })) as unknown as typeof window.matchMedia;
  render(<TruncatedText className="truncate">{NAME}</TruncatedText>);
  const text = screen.getByText(NAME);
  sized(text, { cut: true });
  fireEvent.mouseEnter(text);
  expect(bubble()).not.toBeInTheDocument();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe('where the bubble goes', () => {
  // A long name's bubble runs to several lines. jsdom lays nothing out.
  beforeEach(() =>
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 96 }),
  );
  afterEach(() => {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, value: 0 });
    jest.restoreAllMocks();
  });
  const topWhenNameIsAt = (top: number) => {
    render(<TruncatedText className="truncate">{NAME}</TruncatedText>);
    const text = screen.getByText(NAME);
    sized(text, { cut: true });
    jest
      .spyOn(text, 'getBoundingClientRect')
      .mockReturnValue({ left: 100, width: 120, top, bottom: top + 20 } as DOMRect);
    fireEvent.mouseEnter(text);
    return (bubble() as HTMLElement).style.top;
  };

  it('sits above the name when there is room', () => {
    expect(topWhenNameIsAt(300)).toBe('196px');
  });

  it('goes below the name when it would start off the top of the screen', () => {
    // 60 - 96 is off screen: 8px under the name instead.
    expect(topWhenNameIsAt(60)).toBe('88px');
  });
});

it('breaks a name with no spaces, so it cannot run out of the bubble', () => {
  render(<TruncatedText className="truncate">{'a'.repeat(80) + '@example.com'}</TruncatedText>);
  const text = screen.getByText(/@example\.com$/);
  sized(text, { cut: true });
  fireEvent.mouseEnter(text);
  expect(bubble()).toHaveClass('[overflow-wrap:anywhere]');
});
