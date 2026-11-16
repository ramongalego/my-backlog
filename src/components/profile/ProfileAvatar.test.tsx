import { act, fireEvent, render, screen } from '@testing-library/react';
import { ProfileAvatar } from '@/components/profile/ProfileAvatar';

jest.mock('next/image', () => ({
  __esModule: true,
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

type Result = { ok: true } | { ok: false; error: string };
const onUpload = jest.fn<Promise<Result>, [File]>();
const onRemove = jest.fn<Promise<Result>, []>();

const draw = (hasOwnPicture = false, src: string | null = null) =>
  render(
    <ProfileAvatar
      src={src}
      name="Ankrath"
      hasOwnPicture={hasOwnPicture}
      onUpload={onUpload}
      onRemove={onRemove}
    />,
  );
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const pick = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });
const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  jest.clearAllMocks();
  onUpload.mockResolvedValue({ ok: true });
  onRemove.mockResolvedValue({ ok: true });
});

it('opens the file picker from the picture, for images', () => {
  draw();
  const click = jest.spyOn(fileInput(), 'click');
  fireEvent.click(screen.getByRole('button', { name: 'Change picture' }));
  expect(click).toHaveBeenCalled();
  expect(fileInput()).toHaveAttribute('accept', 'image/*');
});

it('uploads the picture picked, once, and says it is working meanwhile', async () => {
  let done!: (result: Result) => void;
  onUpload.mockReturnValue(new Promise((resolve) => (done = resolve)));
  draw();
  await act(async () => {
    pick(photo);
    pick(photo);
  });
  expect(onUpload).toHaveBeenCalledTimes(1);
  expect(onUpload).toHaveBeenCalledWith(photo);
  // Marked as busy, not disabled: it may hold the focus.
  const change = screen.getByRole('button', { name: 'Change picture' });
  expect(change).toHaveAttribute('aria-disabled', 'true');
  expect(change).toBeEnabled();
  const click = jest.spyOn(fileInput(), 'click');
  fireEvent.click(change);
  expect(click).not.toHaveBeenCalled();

  await act(async () => done({ ok: true }));
  expect(change).not.toHaveAttribute('aria-disabled');
});

it('takes a picture of their own off with its X', async () => {
  draw(true, 'https://example.supabase.co/storage/v1/object/public/avatars/u/a.webp');
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Remove picture' })));
  expect(onRemove).toHaveBeenCalledTimes(1);
});

it('moves focus to the picture when its X is pressed, since the X goes', async () => {
  let done!: (result: Result) => void;
  onRemove.mockReturnValue(new Promise((resolve) => (done = resolve)));
  draw(true, 'https://example.supabase.co/storage/v1/object/public/avatars/u/a.webp');
  const x = screen.getByRole('button', { name: 'Remove picture' });
  x.focus();
  await act(async () => fireEvent.click(x));

  expect(screen.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Change picture' })).toHaveFocus();
  await act(async () => done({ ok: true }));
});

it('has no X for a picture that is not theirs to take off', () => {
  draw(false, 'https://avatars.steamstatic.com/a_full.jpg');
  expect(screen.queryByRole('button', { name: 'Remove picture' })).not.toBeInTheDocument();
});

it('shows the X on hover or for the keyboard, and always under a finger', () => {
  draw(true, 'https://example.supabase.co/storage/v1/object/public/avatars/u/a.webp');
  expect(screen.getByRole('button', { name: 'Remove picture' })).toHaveClass(
    'opacity-0',
    'group-hover:opacity-100',
    'focus-visible:opacity-100',
    'pointer-coarse:opacity-100',
  );
});
