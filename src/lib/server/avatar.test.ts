/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { avatarFolder, deleteAvatars, newAvatarPath, readImage } from '@/lib/server/avatar';

const bytes = (...values: (number | string | number[])[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === 'string'
        ? [...value].map((c) => c.charCodeAt(0))
        : Array.isArray(value)
          ? value
          : [value],
    ),
  );
const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const be16 = (n: number) => [(n >> 8) & 255, n & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

/** The start of a real file of each kind, with the size it says it is. */
const png = (width: number, height: number) =>
  bytes(
    0x89,
    'PNG',
    [13, 10, 26, 10],
    be32(13),
    'IHDR',
    be32(width),
    be32(height),
    [8, 6, 0, 0, 0],
  );
const jpeg = (width: number, height: number) =>
  bytes(
    [0xff, 0xd8],
    // An application segment to walk past, then the frame header.
    [0xff, 0xe0],
    be16(16),
    'JFIF',
    new Array(10).fill(0),
    [0xff, 0xc0],
    be16(17),
    8,
    be16(height),
    be16(width),
    new Array(12).fill(0),
  );
const webp = (width: number, height: number) =>
  bytes(
    'RIFF',
    be32(0),
    'WEBP',
    'VP8X',
    [10, 0, 0, 0],
    [0, 0, 0, 0],
    le24(width - 1),
    le24(height - 1),
  );

describe('readImage', () => {
  it('reads the kind of picture and its size from the file itself', () => {
    expect(readImage(png(256, 256))).toEqual({ type: 'image/png', width: 256, height: 256 });
    expect(readImage(jpeg(640, 480))).toEqual({ type: 'image/jpeg', width: 640, height: 480 });
    expect(readImage(webp(256, 128))).toEqual({ type: 'image/webp', width: 256, height: 128 });
  });

  it('reads the other two kinds of WebP too', () => {
    // Lossy: a frame tag, the start code, then 14 bits each of width and height.
    const lossy = bytes(
      'RIFF',
      be32(0),
      'WEBP',
      'VP8 ',
      be32(0),
      [0, 0, 0],
      [0x9d, 0x01, 0x2a],
      [0, 1],
      [0x80, 0],
    );
    expect(readImage(lossy)).toEqual({ type: 'image/webp', width: 256, height: 128 });
    // Lossless: a signature byte, then width - 1 and height - 1 packed in 28 bits.
    const packed = (256 - 1) | ((128 - 1) << 14);
    const lossless = bytes(
      'RIFF',
      be32(0),
      'WEBP',
      'VP8L',
      be32(0),
      0x2f,
      [packed & 255, (packed >> 8) & 255, (packed >> 16) & 255, (packed >> 24) & 255],
      new Array(8).fill(0),
    );
    expect(readImage(lossless)).toEqual({ type: 'image/webp', width: 256, height: 128 });
  });

  it('refuses anything that is not one of the three, whatever it is called', () => {
    expect(readImage(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(readImage(bytes('GIF89a', new Array(30).fill(0)))).toBeNull();
    expect(readImage(bytes('RIFF', be32(0), 'WAVE', new Array(30).fill(0)))).toBeNull();
    expect(readImage(new Uint8Array())).toBeNull();
  });

  it('refuses a file that only starts like a picture: it would draw as a broken image', () => {
    // The first bytes of a JPEG, then nothing that is one.
    const junk = new Uint8Array(40 * 1024).map((_, i) => (i * 31) % 251);
    junk.set([0xff, 0xd8, 0xff, 0xe0]);
    expect(readImage(junk)).toBeNull();
    expect(readImage(bytes(0x89, 'PNG', [13, 10, 26, 10], new Array(30).fill(7)))).toBeNull();
    expect(readImage(bytes('RIFF', be32(0), 'WEBP', 'VP8 ', new Array(30).fill(0)))).toBeNull();
    expect(readImage(bytes([0xff, 0xd8, 0xff]))).toBeNull();
  });

  it('gives the size a small file claims, however large, for the route to refuse', () => {
    expect(readImage(png(60000, 60000))).toMatchObject({ width: 60000, height: 60000 });
    expect(readImage(png(0, 100))).toBeNull();
  });
});

const FOLDER = avatarFolder('user-1');

it("stores each new picture under a name of its own in the player's folder", () => {
  const first = newAvatarPath('user-1', 'image/webp');
  expect(first).toMatch(new RegExp(`^${FOLDER}/[0-9a-f-]{36}\.webp$`));
  expect(newAvatarPath('user-1', 'image/jpeg')).toMatch(/\.jpg$/);
  expect(newAvatarPath('user-1', 'image/webp')).not.toBe(first);
});

it("names the folder without the account id, which the picture's address would publish", () => {
  const id = '28f2ff71-0000-4000-8000-123456789abc';
  const folder = avatarFolder(id);
  expect(folder).toMatch(/^[0-9a-f]{32}$/);
  expect(newAvatarPath(id, 'image/png')).not.toContain(id);
  expect(folder).not.toContain(id.slice(0, 8));
  // The same player's folder every time, and nobody else's.
  expect(avatarFolder(id)).toBe(folder);
  expect(avatarFolder('28f2ff71-0000-4000-8000-123456789abd')).not.toBe(folder);
});

describe('deleteAvatars', () => {
  let stored: { name: string }[];
  let listError: { message: string } | null;
  const listed: unknown[][] = [];
  const removed: string[][] = [];
  const service = {
    storage: {
      from: () => ({
        list: async (...args: unknown[]) => {
          listed.push(args);
          return { data: listError ? null : stored, error: listError };
        },
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;

  beforeEach(() => {
    stored = [{ name: 'old.webp' }, { name: 'left-behind.webp' }, { name: 'new.webp' }];
    listError = null;
    listed.length = 0;
    removed.length = 0;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  it("deletes everything in the player's own folder but the picture to keep", async () => {
    await deleteAvatars(service, 'user-1', `${FOLDER}/new.webp`);
    // By the folder: a picture two uploads at once left behind goes too.
    expect(listed[0][0]).toBe(FOLDER);
    expect(removed).toEqual([[`${FOLDER}/old.webp`, `${FOLDER}/left-behind.webp`]]);
  });

  it('deletes all of them when there is none to keep', async () => {
    await deleteAvatars(service, 'user-1');
    expect(removed[0]).toHaveLength(3);
  });

  it('asks for nothing to be deleted when only the kept picture is there', async () => {
    stored = [{ name: 'new.webp' }];
    await deleteAvatars(service, 'user-1', `${FOLDER}/new.webp`);
    expect(removed).toEqual([]);
  });

  it('logs a folder it could not read, and deletes nothing', async () => {
    listError = { message: 'storage down' };
    await deleteAvatars(service, 'user-1');
    expect(removed).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
