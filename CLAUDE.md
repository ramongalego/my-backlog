# MyBacklog

A Steam backlog tracker: sync your Steam library, pick what to play next, keep a queue, a diary of finished games and stats.

Next.js 16 (App Router, Turbopack, React Compiler), React 19, TypeScript, Tailwind v4, TanStack Query v5, Supabase (auth, Postgres with RLS).

## Commands

- `npm run dev`: dev server on http://localhost:3000
- `npm test`: Jest (not Vitest)
- `npm run lint`, `npx tsc --noEmit`, `npx prettier --check "src/**/*.{ts,tsx,css}"`
- `npm run build`
- `npm run check:unused`: knip, for unused files, exports and dependencies (CI runs it too). `knip.json` lists its known false positives.
- `npm run check:hltb`: looks a few games up on HowLongToBeat for real, to see the lookup still works (HLTB changes its site now and then). A GitHub Action runs it daily and emails on failure.

## Where things live

- `src/app/(app)/`: signed-in pages. Each has a server `page.tsx` that prefetches data, a client `View.tsx`, a `loading.tsx` and a `Skeleton.tsx` that mirrors the page layout.
- `src/components/<page>/`: the pieces of one page (`stats/`, `queue/`, `diary/`, `home/`, `landing/`, …), one component per file, so a bug in, say, the year chart is in `components/stats/YearChart.tsx`. A page's `View.tsx` only wires them together: data, dialogs, empty and loading states. Components used across pages live in `components/games/` (game art, cards, the game dialog) and `components/ui/` (buttons, panels, menus).
- `src/app/(marketing)/`: the public landing page (its sections are in `components/landing/`).
- `src/lib/data/loaders.ts` and `src/lib/data/prefetch.ts`: shared data loaders used both for the server prefetch and the client queries.
- `src/lib/` is organised by where code runs:
  - `lib/client/`: browser code that calls the app's API (`game-status`, `queue`, `manual-games`) or reads the database from the browser (`random-pick`).
  - `lib/server/`: the app's server-side logic: applying status changes, rate limits, API responses, syncing Steam data into the database. Every file starts with `import 'server-only'`, so importing one into a component fails the build.
  - `lib/steam`, `lib/igdb`, `lib/hltb`, `lib/steamgriddb`, `lib/supabase`: talking to outside services (their server files are marked `server-only` too).
  - Everything else (`lib/games`, `lib/suggest`, `lib/diary`, …): pure rules and helpers that run anywhere. `npm run lint` enforces these layers (`eslint.config.mjs`): pure folders can't import the database client, `lib/client`, hooks or components; hooks and components can't import `lib/server`; components can't import the database client (sign-in and sign-out excepted).
- `src/hooks/`: each page's state and actions are in `use<Page>Page` (`useHomePage`, `useGamesPage`, `useQueuePage`, `useDiaryPage`, `useStatsPage`); hooks shared between pages are named for what they do (`useNowPlaying`, `useQueue`, `useSwitchGame`, `useGameMutations`). Mutations invalidate React Query caches; pages read everything from React Query.
- `src/components/layout/` is the app's frame (header, user menu, footer, page container); `src/components/sync/` is the Steam library sync and its progress.
- A file is named for what it exports (`GameDetailModal.tsx` exports `GameDetailModal`).
- Tests sit next to the file they test: `YearChart.test.tsx` beside `YearChart.tsx`, `route.test.ts` beside an API `route.ts`. Several tests of one file are named for their topic (`steam-library.clear.test.ts`). Tests call the real code; they never copy it into the test.
- `src/live-checks/`: checks against real outside services (`npm run check:hltb`), left out of `npm test`.
- `supabase/schema.sql` and `supabase/migrations/`: the database. The user applies migrations by hand.

## How a change flows

**Loading a page** (e.g. Games):

1. `app/(app)/games/page.tsx` runs on the server: `prefetchForUser` (`lib/data/prefetch.ts`) loads the data with the loaders in `lib/data/loaders.ts` and hands it to the browser in a `HydrationBoundary`.
2. `View.tsx` gets its state and actions from its page hook (`hooks/useGamesPage.ts`), which reads React Query with the same definitions (`lib/data/queries.ts`), so the prefetched data is used straight away, with no second fetch.
3. `View.tsx` draws the page from `components/games/` and `components/ui/`; while it loads, `loading.tsx` shows `Skeleton.tsx`.

**Changing a game's status** (e.g. marking it finished in its dialog):

1. `components/games/GameDetailModal.tsx` calls the page's `onConfirm`, which is `handleConfirmDetail` in `hooks/useGamesPage.ts`.
2. That runs `useSetGameStatus` (`hooks/useGameMutations.ts`), which updates the cached games list at once (so the page changes before the server answers) and calls `updateGameStatus` in `lib/client/game-status.ts`.
3. That POSTs to `app/api/games/status/route.ts`, which checks the user, the rate limit (`lib/server/rate-limit.ts`) and the body (`lib/validations/games.ts`), then calls `applyStatusChange` in `lib/server/apply-status.ts`.
4. `applyStatusChange` works out each row's new columns with the rules in `lib/games/status-rules.ts` (only one game playing, finished games get their date and rating, the queue only holds backlog games) and saves them in one transaction, through the `apply_status_change` database function. The statuses themselves are listed once, in `lib/games/status.ts`.
5. Back in the browser, `statusChanged` (`useInvalidateQueries`) refreshes everything else the change touches: the playing game, the diary, counts, carousels and the queue. If the save failed, the cached list is put back.

Playing, finishing and the queue go the same way through `hooks/useNowPlaying.ts` and `hooks/useSwitchGame.ts`.

**Where to look for a bug:**

| Symptom | Start at |
|---|---|
| Something looks wrong on a page | `components/<page>/`, then the page's `View.tsx` |
| The page shows the wrong data | its page hook in `hooks/`, then `lib/data/loaders.ts` (Games filter, search and counts: `lib/games/library-filter.ts`; Diary grouping: `lib/diary/timeline.ts`) |
| A button does the wrong thing | the page hook's handler, then `lib/client/` and the matching `app/api/…/route.ts` |
| A rule is wrong (what a status does, picks, stats) | `lib/games/` or `lib/suggest/` (pure, with tests beside them) |
| Steam, IGDB or HowLongToBeat data is wrong | `lib/steam`, `lib/igdb`, `lib/hltb`, and `lib/server/steam-library.ts` for what's saved |

## UI and design

**Read `DESIGN.md` before building or changing any UI.** It is the design system: palette, type, layout, components and rules.

The short version:
- Use the shared components in `src/components/ui/`, `src/components/layout/` and `src/components/games/` (`Button`, `Panel`, `ToggleGroup`, `EmptyState`, `Input`/`fieldClass`, `PageHeader`, `CoverArt`, `StatusBadge`, ...). If you're about to write a pattern for the second time, make it a component instead.
- Colours are `ink-*` (warm neutrals) and `accent-*` (orange) tokens from `src/app/globals.css`. Status colours come from `STATUS_STYLE` in `src/lib/games/status-style.ts`.
- Orange is only for the primary action, the current page and the game being played. Text on orange is `ink-950`.
- No gradient text, glows, kicker labels, uppercase tracked labels, nested cards or icon tiles.
- Every new page gets a matching skeleton and must work at phone width without horizontal scroll.

To check new UI for generic AI patterns and contrast problems, run Impeccable's detector:

```bash
npx impeccable detect src/
```

It reads `DESIGN.md`. Pass a URL (e.g. `http://localhost:3000/`) to scan a rendered public page.

## Conventions

- Commits carry only the author's name: no `Co-Authored-By` or AI attribution lines.
- Never print or commit secrets from `.env`.
