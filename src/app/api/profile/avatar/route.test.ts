/**
 * @jest-environment node
 */
import type { NextRequest } from 'next/server';
import { DELETE, POST } from '@/app/api/profile/avatar/route';

const BASE = 'https://abc.supabase.co/storage/v1/object/public/avatars/';
let user: { id: string } | null = { id: 'user-1' };
let limited = false;
let current: string | null = null;
let uploadError: { message: string } | null = null;
const uploads: { path: string; options: unknown }[] = [];
const removed: string[][] = [];
const profileUpdates: Record<string, unknown>[] = [];

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
}));
jest.mock('@/lib/supabase/service', () => ({
  tryCreateServiceClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ single: async () => ({ data: { avatar_url: current } }) }),
      }),
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          profileUpdates.push(values);
          return { error: null };
        },
      }),
    }),
    storage: {
      from: () => ({
        upload: async (path: string, _bytes: unknown, options: unknown) => {
          uploads.push({ path, options });
          return { error: uploadError };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `${BASE}${path}` } }),
        remove: async (paths: string[]) => {
          removed.push(paths);
          return { error: null };
        },
      }),
    },
  }),
}));
jest.mock('@/lib/server/rate-limit', () => ({
  ...jest.requireActual('@/lib/server/rate-limit'),
  checkSharedRateLimit: async () => ({
    success: !limited,
    limit: 10,
    remaining: 0,
    resetAt: Date.now() + 60_000,
  }),
}));

const WEBP = new Uint8Array([...'RIFF\0\0\0\0WEBPVP8 '].map((c) => c.charCodeAt(0)));
const upload = async (file: Blob | string | null) => {
  const form = new FormData();
  if (file) form.append('file', file);
  const res = await POST(
    new Request('http://localhost/api/profile/avatar', {
      method: 'POST',
      body: form,
    }) as unknown as NextRequest,
  );
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  user = { id: 'user-1' };
  limited = false;
  current = null;
  uploadError = null;
  uploads.length = 0;
  removed.length = 0;
  profileUpdates.length = 0;
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it("stores the picture in the player's folder and puts it on the profile", async () => {
  const res = await upload(new Blob([WEBP], { type: 'image/webp' }));
  expect(res.status).toBe(200);
  expect(uploads).toHaveLength(1);
  expect(uploads[0].path).toMatch(/^user-1\/[0-9a-f-]{36}\.webp$/);
  expect(uploads[0].options).toMatchObject({ contentType: 'image/webp', upsert: false });
  expect(res.body).toEqual({ avatarUrl: `${BASE}${uploads[0].path}` });
  expect(profileUpdates[0].avatar_url).toBe(res.body.avatarUrl);
  // Nothing was there before to delete.
  expect(removed).toEqual([]);
});

it('deletes the picture it replaces', async () => {
  current = `${BASE}user-1/old.webp`;
  await upload(new Blob([WEBP], { type: 'image/webp' }));
  expect(removed).toEqual([['user-1/old.webp']]);
});

it('goes by the bytes, not by what the upload says it is', async () => {
  const svg = new Blob(['<svg xmlns="http://www.w3.org/2000/svg"/>'], { type: 'image/webp' });
  expect(await upload(svg)).toEqual({
    status: 400,
    body: { error: 'Use a JPEG, PNG or WebP picture' },
  });
  expect(uploads).toEqual([]);
});

it('refuses a picture over 512 KB, and a request with none', async () => {
  const big = new Blob([WEBP, new Uint8Array(512 * 1024)]);
  expect((await upload(big)).status).toBe(413);
  expect((await upload(null)).status).toBe(400);
  expect((await upload('not a file')).status).toBe(400);
  expect(uploads).toEqual([]);
});

it('refuses a signed-out request, and one past the limit', async () => {
  user = null;
  expect((await upload(new Blob([WEBP]))).status).toBe(401);
  user = { id: 'user-1' };
  limited = true;
  expect((await upload(new Blob([WEBP]))).status).toBe(429);
  expect(uploads).toEqual([]);
});

it('leaves the profile as it was when the upload fails', async () => {
  uploadError = { message: 'storage down' };
  expect(await upload(new Blob([WEBP]))).toEqual({
    status: 500,
    body: { error: "Couldn't save your picture. Please try again." },
  });
  expect(profileUpdates).toEqual([]);
});

describe('removing it', () => {
  it('takes the picture off the profile and deletes the file', async () => {
    current = `${BASE}user-1/mine.webp`;
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(profileUpdates[0].avatar_url).toBeNull();
    expect(removed).toEqual([['user-1/mine.webp']]);
  });

  it('refuses a signed-out request', async () => {
    user = null;
    expect((await DELETE()).status).toBe(401);
    expect(profileUpdates).toEqual([]);
  });
});
