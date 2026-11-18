import { fireEvent, render, screen } from '@testing-library/react';
import { DiaryRow } from '@/components/diary/DiaryRow';
import type { DiaryEntry } from '@/lib/data/loaders';

jest.mock('@/hooks/useLibraryMeta', () => ({
  ...jest.requireActual('@/hooks/useLibraryMeta'),
  useLibraryPlatforms: () => null,
}));
jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

const entry = (notes: string | null): DiaryEntry =>
  ({
    id: 7,
    source: 'manual',
    platform: null,
    app_id: null,
    name: 'Hades',
    header_image: null,
    rating: 9,
    notes,
    finished_at: '2026-11-10T00:00:00+00:00',
    playtime_forever: 0,
    main_story_hours: null,
    steam_review_score: null,
    steam_review_count: null,
    critic_score: null,
    critic_count: null,
  }) as DiaryEntry;

const onSaveNotes = jest.fn();
const row = (notes: string | null) =>
  render(<DiaryRow entry={entry(notes)} onEdit={jest.fn()} onSaveNotes={onSaveNotes} />);

beforeEach(() => onSaveNotes.mockClear());

describe('the focus, when the note editor closes', () => {
  it('goes back to Edit note after saving', () => {
    row('Loved it');
    fireEvent.click(screen.getByRole('button', { name: 'Edit note for Hades' }));
    fireEvent.change(screen.getByLabelText('Note for Hades'), {
      target: { value: 'Still love it' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save note' }));

    expect(onSaveNotes).toHaveBeenCalledWith(7, 'Still love it');
    expect(screen.getByRole('button', { name: 'Edit note for Hades' })).toHaveFocus();
  });

  it('goes back to Edit note when Escape cancels it', () => {
    row('Loved it');
    fireEvent.click(screen.getByRole('button', { name: 'Edit note for Hades' }));
    fireEvent.keyDown(screen.getByLabelText('Note for Hades'), { key: 'Escape' });

    expect(screen.getByRole('button', { name: 'Edit note for Hades' })).toHaveFocus();
  });

  it('goes back to Add a note when there was no note and none was written', () => {
    row(null);
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a note for Hades' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getAllByRole('button', { name: 'Add a note for Hades' })[0]).toHaveFocus();
  });

  it("doesn't take the focus before the editor was ever opened", () => {
    row('Loved it');
    expect(document.body).toHaveFocus();
  });
});
