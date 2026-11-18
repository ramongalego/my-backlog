/**
 * @jest-environment node
 */
// What reaches Sentry is what's logged with console.error on the server, so
// one game's failed store lookup is a warning.
import { getStoreItemInfo } from '@/lib/steam/store-api';

const TAG_LIST = { response: { tags: [{ tagid: 1, name: 'RPG' }] } };

let errors: jest.SpyInstance;
let warnings: jest.SpyInstance;
beforeEach(() => {
  errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  warnings = jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

const mockStore = (items: () => Response) => {
  global.fetch = jest.fn(async (input: RequestInfo | URL) =>
    String(input).includes('GetTagList') ? new Response(JSON.stringify(TAG_LIST)) : items(),
  ) as typeof fetch;
};

it("warns, and reports nothing, when one game's store lookup times out", async () => {
  mockStore(() => {
    throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  });
  await expect(getStoreItemInfo(200110)).resolves.toBeNull();
  expect(warnings).toHaveBeenCalled();
  expect(errors).not.toHaveBeenCalled();
});

it("warns, and reports nothing, when one game's store lookup fails", async () => {
  mockStore(() => new Response('', { status: 502 }));
  await expect(getStoreItemInfo(200110)).resolves.toBeNull();
  expect(warnings).toHaveBeenCalledWith('[Steam Store] GetItems failed for appId=200110: HTTP 502');
  expect(errors).not.toHaveBeenCalled();
});
