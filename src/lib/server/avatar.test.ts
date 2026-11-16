/**
 * @jest-environment node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { deleteAvatars, imageTypeOf, newAvatarPath } from '@/lib/server/avatar';

const bytes = (...values: (number | string)[]) =>
  new Uint8Array(
    values.flatMap((value) =>
      typeof value === 'string' ? [...value].map((c) => c.charCodeAt(0)) : [value],
    ),
  );

describe('imageTypeOf', () => {
  it('reads the kind of picture from the file itself', () => {
    expect(imageTypeOf(bytes('RIFF', 0, 0, 0, 0, 'WEBPVP8 '))).toBe('image/webp');
    expect(imageTypeOf(bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(imageTypeOf(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });

  it('refuses anything else, whatever it is called', () => {
    expect(imageTypeOf(bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeNull();
    expect(imageTypeOf(bytes('GIF89a'))).toBeNull();
    expect(imageTypeOf(bytes('RIFF', 0, 0, 0, 0, 'WAVE'))).toBeNull();
    expect(imageTypeOf(new Uint8Array())).toBeNull();
  });
});

it("stores each new picture under a name of its own in the player's folder", () => {
  const first = newAvatarPath('user-1', 'image/webp');
  expect(first).toMatch(/^user-1\/[0-9a-f-]{36}\.webp$/);
  expect(newAvatarPath('user-1', 'image/jpeg')).toMatch(/\.jpg$/);
  expect(newAvatarPath('user-1', 'image/webp')).not.toBe(first);
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
    await deleteAvatars(service, 'user-1', 'user-1/new.webp');
    // By the folder: a picture two uploads at once left behind goes too.
    expect(listed[0][0]).toBe('user-1');
    expect(removed).toEqual([['user-1/old.webp', 'user-1/left-behind.webp']]);
  });

  it('deletes all of them when there is none to keep', async () => {
    await deleteAvatars(service, 'user-1');
    expect(removed[0]).toHaveLength(3);
  });

  it('asks for nothing to be deleted when only the kept picture is there', async () => {
    stored = [{ name: 'new.webp' }];
    await deleteAvatars(service, 'user-1', 'user-1/new.webp');
    expect(removed).toEqual([]);
  });

  it('logs a folder it could not read, and deletes nothing', async () => {
    listError = { message: 'storage down' };
    await deleteAvatars(service, 'user-1');
    expect(removed).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
