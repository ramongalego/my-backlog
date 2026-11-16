import { steamConnectUrl } from '@/lib/client/steam-connect';

it('starts connecting Steam saying which page to come back to', () => {
  expect(steamConnectUrl({ pathname: '/profile', search: '' })).toBe(
    '/api/steam/auth?from=%2Fprofile',
  );
  expect(steamConnectUrl({ pathname: '/games', search: '?status=backlog&platform=PC' })).toBe(
    '/api/steam/auth?from=%2Fgames%3Fstatus%3Dbacklog%26platform%3DPC',
  );
});
