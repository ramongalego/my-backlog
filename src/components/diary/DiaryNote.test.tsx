import { fireEvent, render, screen } from '@testing-library/react';
import { DiaryNoteEditor } from '@/components/diary/DiaryNote';

const onSave = jest.fn();
const onCancel = jest.fn();
const editor = (initialText = '') =>
  render(
    <DiaryNoteEditor
      initialText={initialText}
      gameName="Hades"
      onSave={onSave}
      onCancel={onCancel}
    />,
  );
const note = () => screen.getByLabelText('Note for Hades');

beforeEach(() => jest.clearAllMocks());

it('saves the note once, trimmed, however many times Save is pressed', () => {
  editor();
  fireEvent.change(note(), { target: { value: '  Loved it <3  ' } });
  const save = screen.getByRole('button', { name: 'Save note' });

  fireEvent.click(save);
  fireEvent.click(save);
  fireEvent.click(save);

  expect(onSave).toHaveBeenCalledTimes(1);
  expect(onSave).toHaveBeenCalledWith('Loved it <3');
});

it('saves with Ctrl+Enter and cancels with Escape', () => {
  editor('Old note');
  fireEvent.keyDown(note(), { key: 'Escape' });
  expect(onCancel).toHaveBeenCalledTimes(1);

  fireEvent.keyDown(note(), { key: 'Enter', ctrlKey: true });
  expect(onSave).toHaveBeenCalledWith('Old note');
});

it('stops at the longest note the server takes', () => {
  editor();
  expect(note()).toHaveAttribute('maxlength', '1000');
});
