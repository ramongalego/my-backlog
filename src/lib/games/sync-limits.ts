// Shared by the browser, which splits its requests to fit, and the routes'
// validation. Kept apart from the zod schemas so the browser doesn't load zod.

/** For /api/games/sync/bulk. */
export const MAX_BULK_APP_IDS = 2000;

/** The lookups run one after another on the server, so a request stays small. */
export const MAX_HLTB_APP_IDS = 5;
