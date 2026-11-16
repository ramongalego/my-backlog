/**
 * @jest-environment node
 */
import { avatarPathOf, imageTypeOf, newAvatarPath } from '@/lib/server/avatar';

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

describe('avatarPathOf', () => {
  const base = 'https://abc.supabase.co/storage/v1/object/public/avatars/';

  it("finds the stored file behind the player's own picture", () => {
    expect(avatarPathOf(`${base}user-1/a.webp`, 'user-1')).toBe('user-1/a.webp');
  });

  it("never names a file outside the player's own folder, or anything else", () => {
    expect(avatarPathOf(`${base}user-2/a.webp`, 'user-1')).toBeNull();
    expect(avatarPathOf(`${base}user-1/../user-2/a.webp`, 'user-1')).toBeNull();
    expect(avatarPathOf('https://avatars.steamstatic.com/a_full.jpg', 'user-1')).toBeNull();
    expect(avatarPathOf(null, 'user-1')).toBeNull();
  });
});
