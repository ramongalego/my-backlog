import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { LegalContents } from '@/components/legal/LegalContents';

const sections = [
  { id: 'collect', title: 'What we collect' },
  { id: 'rights', title: 'Your rights' },
  { id: 'contact', title: 'Contact' },
];

/** Where each heading's top is, from the top of the window. */
let tops: Record<string, number>;

beforeEach(() => {
  document.body.innerHTML = '';
  for (const { id } of sections) {
    const heading = document.createElement('h2');
    heading.id = id;
    heading.getBoundingClientRect = () => ({ top: tops[id] }) as DOMRect;
    document.body.appendChild(heading);
  }
  tops = { collect: 600, rights: 1400, contact: 2200 };
  // As globals.css sets it: where a jumped-to heading lands.
  document.documentElement.style.scrollPaddingTop = '80px';
  // A frame runs at once here: what scrolling sets off is in place when the event returns.
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((step) => {
    step(0);
    // As if it had already run: the frame it would have been is done.
    return 0;
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 5000,
  });
});
afterEach(() => jest.restoreAllMocks());

const scrolledTo = (next: Record<string, number>) =>
  act(() => {
    tops = next;
    window.dispatchEvent(new Event('scroll'));
  });
const marked = () =>
  within(screen.getByRole('navigation', { name: 'On this page' }))
    .queryAllByRole('link')
    .filter((link) => link.getAttribute('aria-current') === 'location')
    .map((link) => link.textContent);

it('lists the sections, numbered, as links to each', () => {
  render(<LegalContents sections={sections} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  const links = within(screen.getByRole('navigation', { name: 'On this page' })).getAllByRole(
    'link',
  );
  expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
    ['1. What we collect', '#collect'],
    ['2. Your rights', '#rights'],
    ['3. Contact', '#contact'],
  ]);
});

it('marks the section being read: the last whose heading has reached the top', () => {
  render(<LegalContents sections={sections} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  // The opening is being read: nothing yet.
  expect(marked()).toEqual([]);

  scrolledTo({ collect: 40, rights: 800, contact: 1600 });
  expect(marked()).toEqual(['1. What we collect']);

  scrolledTo({ collect: -900, rights: 100, contact: 900 });
  expect(marked()).toEqual(['2. Your rights']);
});

it("marks the last section at the very bottom, where its heading can't reach the top", () => {
  render(<LegalContents sections={sections} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 0 });
  scrolledTo({ collect: -1500, rights: -600, contact: 400 });
  expect(marked()).toEqual(['3. Contact']);
});

it('shows the mark only where the list stays in view, beside the text', () => {
  render(<LegalContents sections={sections} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  scrolledTo({ collect: 40, rights: 800, contact: 1600 });
  const link = screen.getByRole('link', { name: '1. What we collect' });
  expect(link).toHaveClass('lg:text-ink-50');
  expect(screen.getByRole('link', { name: '2. Your rights' })).not.toHaveClass('lg:text-ink-50');
});

it('marks the section a link jumped to, where the jump leaves its heading', () => {
  render(<LegalContents sections={sections} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  // Landed exactly at the scroll padding, the previous heading just above it.
  scrolledTo({ collect: -700, rights: 80, contact: 900 });
  expect(marked()).toEqual(['2. Your rights']);
});

it("marks a short section clicked near the end, though the page can't scroll its heading up", () => {
  render(<LegalContents sections={sections} />, {
    container: document.body.appendChild(document.createElement('div')),
  });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 0 });
  fireEvent.click(screen.getByRole('link', { name: '2. Your rights' }));
  // At the bottom, its heading short of the line.
  scrolledTo({ collect: -900, rights: 175, contact: 500 });
  expect(marked()).toEqual(['2. Your rights']);

  // Scrolled away from the bottom and back: the usual rule again.
  Object.defineProperty(document.documentElement, 'scrollHeight', {
    configurable: true,
    value: 5000,
  });
  scrolledTo({ collect: -700, rights: 300, contact: 1000 });
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 0 });
  scrolledTo({ collect: -900, rights: 175, contact: 500 });
  expect(marked()).toEqual(['3. Contact']);
});
