import { act, fireEvent, render, screen } from '@testing-library/react';
import { PictureRow } from '@/components/settings/PictureRow';

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({
    src,
    alt,
    onError,
    className,
  }: {
    src: string;
    alt: string;
    onError?: () => void;
    className?: string;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={onError} className={className} />
  ),
}));

type Result = { ok: true } | { ok: false; error: string };
const onUpload = jest.fn<Promise<Result>, [File]>();
const onRemove = jest.fn<Promise<Result>, []>();

const OWN = 'https://example.supabase.co/storage/v1/object/public/avatars/u/a.webp';

const row = (hasOwnPicture: boolean, src: string | null) => (
  <ul>
    <PictureRow
      src={src}
      name="Ankrath"
      hasOwnPicture={hasOwnPicture}
      onUpload={onUpload}
      onRemove={onRemove}
    />
  </ul>
);
const draw = (hasOwnPicture = false, src: string | null = null) => render(row(hasOwnPicture, src));
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const pick = (file: File) => fireEvent.change(fileInput(), { target: { files: [file] } });
const photo = new File(['x'], 'me.jpg', { type: 'image/jpeg' });

beforeEach(() => {
  jest.clearAllMocks();
  onUpload.mockResolvedValue({ ok: true });
  onRemove.mockResolvedValue({ ok: true });
});

it('shows the picture in use, or the initial without one', () => {
  const { container, rerender } = draw(false, 'https://avatars.steamstatic.com/a_full.jpg');
  expect(screen.getByText('Avatar')).toBeInTheDocument();
  expect(container.querySelector('img')).toHaveAttribute(
    'src',
    'https://avatars.steamstatic.com/a_full.jpg',
  );

  rerender(row(false, null));
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(screen.getByText('A')).toHaveAttribute('aria-hidden', 'true');
});

it('is drawn at the size the profile shows it, so it is seen as it will look there', () => {
  const { container, rerender } = draw(false, 'https://avatars.steamstatic.com/a_full.jpg');
  expect(container.querySelector('img')).toHaveClass('h-16', 'w-16', 'sm:h-20', 'sm:w-20');
  rerender(row(false, null));
  expect(screen.getByText('A')).toHaveClass('h-16', 'w-16', 'sm:h-20', 'sm:w-20');
});

it('opens the file picker from Change, for images', () => {
  draw();
  const click = jest.spyOn(fileInput(), 'click');
  const change = screen.getByRole('button', { name: 'Change avatar' });
  // What's shown is the one word, as on the rows under it.
  expect(change).toHaveTextContent(/^Change$/);
  fireEvent.click(change);
  expect(click).toHaveBeenCalled();
  expect(fileInput()).toHaveAttribute('accept', 'image/*');
});

it('uploads the picture picked, once, and says it is saving meanwhile', async () => {
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
  const saving = screen.getByRole('button', { name: 'Saving…' });
  expect(saving).toHaveAttribute('aria-disabled', 'true');
  expect(saving).toBeEnabled();
  const click = jest.spyOn(fileInput(), 'click');
  fireEvent.click(saving);
  expect(click).not.toHaveBeenCalled();

  await act(async () => done({ ok: true }));
  expect(screen.getByRole('button', { name: 'Change avatar' })).not.toHaveAttribute(
    'aria-disabled',
  );
});

it('can pick the same file again after a failure', async () => {
  onUpload.mockResolvedValueOnce({ ok: false, error: 'That picture is too large' });
  draw();
  await act(async () => pick(photo));
  expect(fileInput().value).toBe('');
  await act(async () => pick(photo));
  expect(onUpload).toHaveBeenCalledTimes(2);
});

it('takes a picture of their own off, once', async () => {
  let done!: (result: Result) => void;
  onRemove.mockReturnValue(new Promise((resolve) => (done = resolve)));
  draw(true, OWN);
  const remove = screen.getByRole('button', { name: 'Remove avatar' });
  expect(remove).toHaveTextContent(/^Remove$/);
  await act(async () => {
    fireEvent.click(remove);
    fireEvent.click(remove);
  });
  expect(onRemove).toHaveBeenCalledTimes(1);
  await act(async () => done({ ok: true }));
});

it('moves focus to Change when Remove is pressed, since Remove goes', async () => {
  let done!: (result: Result) => void;
  onRemove.mockReturnValue(new Promise((resolve) => (done = resolve)));
  draw(true, OWN);
  const remove = screen.getByRole('button', { name: 'Remove avatar' });
  remove.focus();
  await act(async () => fireEvent.click(remove));

  expect(screen.queryByRole('button', { name: 'Remove avatar' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Saving…' })).toHaveFocus();
  await act(async () => done({ ok: true }));
  expect(screen.getByRole('button', { name: 'Change avatar' })).toHaveFocus();
});

it('has no Remove for a picture that is not theirs to take off', () => {
  draw(false, 'https://avatars.steamstatic.com/a_full.jpg');
  expect(screen.queryByRole('button', { name: 'Remove avatar' })).not.toBeInTheDocument();
});

it('gives way to the initial when the picture will not load, and tries a new one afresh', () => {
  const { rerender, container } = draw(true, OWN);
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).not.toBeInTheDocument();
  expect(screen.getByText('A')).toBeInTheDocument();

  rerender(row(true, 'https://x/storage/v1/object/public/avatars/u/b.webp'));
  expect(container.querySelector('img')).toBeInTheDocument();
});
