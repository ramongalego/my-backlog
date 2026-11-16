import { render, screen } from '@testing-library/react';
import { PageHeader, SectionLabel } from '@/components/layout/Page';

it('lets a title or a section heading with an id take focus from script', () => {
  render(
    <>
      <PageHeader title="Stats" id="stats-title" />
      <SectionLabel id="stats-highest-rated">Your highest rated games</SectionLabel>
    </>,
  );
  // Where focus goes when a dialog removes what it was opened from.
  document.getElementById('stats-highest-rated')!.focus();
  expect(screen.getByRole('heading', { name: 'Your highest rated games' })).toHaveFocus();
  document.getElementById('stats-title')!.focus();
  expect(screen.getByRole('heading', { name: 'Stats' })).toHaveFocus();
});

it('keeps a heading with no id out of the way: not focusable at all', () => {
  render(
    <>
      <PageHeader title="Games" />
      <SectionLabel>Up next</SectionLabel>
    </>,
  );
  for (const heading of screen.getAllByRole('heading')) {
    expect(heading).not.toHaveAttribute('tabindex');
  }
});
