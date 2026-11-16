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
