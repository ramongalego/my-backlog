import { isOwner, ownerUserIds } from '@/lib/server/owner';

const OWNER = '28f2ff71-1111-4222-8333-444455556666';
const OTHER = '9a0b1c2d-1111-4222-8333-444455556666';

// The local .env may name a real owner.
beforeEach(() => {
  delete process.env.OWNER_USER_IDS;
});

it('lets nobody in when no owner is set', () => {
  expect(isOwner(OWNER)).toBe(false);
  expect(ownerUserIds()).toEqual([]);
});

it('knows the owners listed, and only them', () => {
  process.env.OWNER_USER_IDS = ` ${OWNER.toUpperCase()} , ${OTHER}`;
  expect(isOwner(OWNER)).toBe(true);
  expect(isOwner(OTHER)).toBe(true);
  expect(isOwner('28f2ff71-1111-4222-8333-000000000000')).toBe(false);
});

it('never matches a missing id or a list that is not account ids', () => {
  process.env.OWNER_USER_IDS = ',*, ,undefined';
  expect(ownerUserIds()).toEqual([]);
  expect(isOwner(undefined)).toBe(false);
  expect(isOwner(null)).toBe(false);
  expect(isOwner('')).toBe(false);
  expect(isOwner('*')).toBe(false);
});
