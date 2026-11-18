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
- `src/app/(app)/privacy` and `terms`: the Privacy Policy and Terms of Service, laid out by `components/legal/LegalPage.tsx`. They state what the app stores, who it sends data to and how it is deleted: a change to any of those changes the page and its effective date too. The contact address is `lib/contact.ts`.
- `src/lib/data/loaders.ts` and `src/lib/data/prefetch.ts`: shared data loaders used both for the server prefetch and the client queries.
- `src/lib/` is organized by where code runs:
  - `lib/client/`: browser code that calls the app's API (`game-status`, `queue`, `manual-games`; the Profile page's `account`, `profile-identity` and `favorites`, all through `request`, which never throws and words offline and rate-limited failures for the player) or reads the database from the browser (`random-pick`).
  - `lib/server/`: the app's server-side logic: applying status changes, rate limits, API responses, syncing Steam data into the database. Every file starts with `import 'server-only'`, so importing one into a component fails the build.
  - `lib/steam`, `lib/igdb`, `lib/hltb`, `lib/steamgriddb`, `lib/supabase`: talking to outside services (their server files are marked `server-only` too).
  - Everything else (`lib/games`, `lib/suggest`, `lib/diary`, …): pure rules and helpers that run anywhere. `npm run lint` enforces these layers (`eslint.config.mjs`): pure folders can't import the database client, `lib/client`, hooks or components; hooks and components can't import `lib/server`; components can't import the database client (sign-in and sign-out excepted).
- `src/hooks/`: each page's state and actions are in `use<Page>Page` (`useHomePage`, `useGamesPage`, `useQueuePage`, `useDiaryPage`, `useStatsPage`, `useProfilePage`); hooks shared between pages are named for what they do (`useNowPlaying`, `useQueue`, `useSwitchGame`, `useGameMutations`, and `useGameDialog` for the queue and "play this instead" parts of every game dialog, with `useLibraryGameDialog` for a page that opens a library game's dialog by its id: Games, Stats and Profile). Mutations invalidate React Query caches; pages read everything from React Query.
- `src/components/layout/` is the app's frame (header, user menu, footer, page container); `src/components/sync/` is the Steam library sync and its progress.
- A file is named for what it exports (`GameDetailModal.tsx` exports `GameDetailModal`).
- Tests sit next to the file they test: `YearChart.test.tsx` beside `YearChart.tsx`, `route.test.ts` beside an API `route.ts`. Several tests of one file are named for their topic (`steam-library.clear.test.ts`). Tests call the real code; they never copy it into the test.
- `src/live-checks/`: checks against real outside services (`npm run check:hltb`), left out of `npm test`.
- `supabase/schema.sql` and `supabase/migrations/`: the database. The user applies migrations by hand, so what lives in the database is tested before it gets there: `supabase/tests/` loads `schema.sql` into a real Postgres that runs inside Jest (PGlite, `database.ts`) and runs functions, triggers and row-level security against it, as a signed-in player (`asUser`) or as the owner. A migration gets a test there that it installs on a database without it and can be applied twice.

## How a change flows

**Loading a page** (e.g. Games):

1. `app/(app)/games/page.tsx` runs on the server: `prefetchForUser` (`lib/data/prefetch.ts`) loads the data with the loaders in `lib/data/loaders.ts` and hands it to the browser through `PrefetchedQueries` (`components/layout/`, a `HydrationBoundary` that also keeps a streamed list from breaking hydration).
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
| A rule is wrong (what a status does, picks, stats) | `lib/games/` or `lib/suggest/` (pure, with tests beside them); the Profile page's name, figures and activity, what a data export holds, and how an account signs in (password, Google, Discord): `lib/account/` |
| Steam, IGDB or HowLongToBeat data is wrong | `lib/steam`, `lib/igdb`, `lib/hltb`, and `lib/server/steam-library.ts` for what's saved |

## UI and design

**Read `DESIGN.md` before building or changing any UI.** It is the design system: palette, type, layout, components and rules.

The short version:
- Use the shared components in `src/components/ui/`, `src/components/layout/` and `src/components/games/` (`Button`, `Panel`, `ToggleGroup`, `EmptyState`, `Input`/`fieldClass`, `PageHeader`, `CoverArt`, `StatusBadge`, ...). If you're about to write a pattern for the second time, make it a component instead.
- Colors are `ink-*` (warm neutrals) and `accent-*` (orange) tokens from `src/app/globals.css`. Status colors come from `STATUS_STYLE` in `src/lib/games/status-style.ts`.
- Orange is only for the primary action, the current page and the game being played. Text on orange is `ink-950`.
- No gradient text, glows, kicker labels, uppercase tracked labels, nested cards or icon tiles.
- Every new page gets a matching skeleton and must work at phone width without horizontal scroll.

To check new UI for generic AI patterns and contrast problems, run Impeccable's detector:

```bash
npx impeccable detect src/
```

It reads `DESIGN.md`. Pass a URL (e.g. `http://localhost:3000/`) to scan a rendered public page.

## Accessibility

The app is checked against WCAG 2.2 AA (axe-core plus a keyboard pass). What new UI has to keep true:

- **A control's name has every word shown inside it, in the order shown** (label in name). A button that holds game art uses `openGameLabel`, `selectGameLabel` or `withArtTags` (`lib/games/game-label.ts`), which add the badges and tags drawn on the art. If the name starts from an `aria-label`, any new badge inside the control must be added to it too.
- **Separate pieces of text inside one control need a space between them** in the markup (`{' '}`), or they run together as one word when read as a whole ("QueuedSwitch").
- **A chip that only repeats what's beside it** (the queue position and the date on phone art) is drawn with CSS (`data-chip` and `before:content-[attr(data-chip)]`, `aria-hidden`), so it isn't text the button's name would need. A `Tooltip` inside a button takes `described={false}`.
- **When an action removes the element that had focus, move focus to what replaced it**: the new heading or group (`tabIndex={-1}`), as the picker's questions, Choose art and the sign-in forms do. Focus never falls back to the page.
- **Something that arrives without focus moving is announced**: a result goes in an `aria-live="polite"` element that was already on the page when its text changes (`SuggestionModal`), progress in `role="status"`, an error in `role="alert"`.
- **What has focus is never under the fixed header.** `scroll-padding-top` on `html` (`globals.css`) keeps the browser from scrolling a focused row or a linked-to place up behind it. Anything else pinned over the page needs the same room left for it.
- Icon-only buttons have an `aria-label` and an `aria-hidden` icon, and are at least 24px to hit: add padding round a small icon, not a bigger icon.
- Pick-one buttons sit in a named `role="group"` and each has `aria-pressed`.
- Form fields have a label, `required` where they are, and errors linked with `aria-describedby` in a `role="alert"` (`Input` does this). Forms are `noValidate`.
- Dialogs use `Modal` (focus goes in, Tab stays in, Escape closes, focus returns). Every animation has a `motion-reduce:` variant.

## Responsive layout

New or changed UI is checked at these widths before it's done, not only at a phone and a desktop: **320** (smallest phones), **390** (most phones), **466 × 678** (a folding phone closed: wide but short), **626 to 669** (a folding phone open), **768** (tablet upright), and a phone on its side (**844 × 390**). What has gone wrong before:

- **640 to 1023px is where layouts break.** `sm:` turns a stacked row into a side-by-side one with only about 600px to share, so anything with fixed-width columns squeezes its text (Diary's title and note got 80px). Give a row its extra columns from `lg:`, and below that keep those values on the title line as on phones (`DiaryRow`). A phone on its side, a small tablet and an open folding phone all land here.
- **Wrap names below `lg`, don't truncate them** (`lg:truncate`, not `sm:truncate`), wherever a second line fits.
- **Anything that pops out of a control inside a dialog must fit the dialog on a phone.** Anchor it to a full-width parent (the field's row), not to the small button it opens from, and size it from the screen (the date calendar: `CompletionDateField`, with its day size in `globals.css`). One that's too wide makes the whole dialog scroll sideways.
- **A button's label stays on one line** (`whitespace-nowrap`), and a row of text actions wraps as whole items (`flex flex-wrap` on the row), never mid-label. Where two buttons can't both fit at 320px, the secondary one gives way (`max-[359px]:flex-none` or `max-[359px]:hidden`).
- **Text links are 24px tall to tap**: `py-1 -my-1` adds the room without moving anything.
- No page scrolls sideways at any width. A row that scrolls on purpose (filter chips, carousels) is the only exception.

## Conventions

- Commits carry only the author's name: no `Co-Authored-By` or AI attribution lines.
- Never print or commit secrets from `.env`.
- **Comments say what the code can't.** Write one only for a reason, a constraint or a trap: why it's done this way, what breaks otherwise, a rule from elsewhere it follows (accessibility, a race, a database or browser quirk). If the names and the code already say it, write nothing. Keep it to a line or two, in plain present-tense words; a longer one is a sign the code or a name should say more. No history ("used to", "now", "was changed so"): that's what commits are for. No restating the type, the function name or the next line, no section banners, no commented-out code. A doc comment on an export is for what its name and types leave out (units, what null means, who calls it). In tests, the test's name says what it checks; a comment is only for setup that isn't obvious. Applied migrations and `supabase/schema.sql` keep their comments as they are: they describe the database as it was set up.
- An account may have no password: one made with Google or Discord (`SocialSignIn`) has none until it sets one by the reset link. Anything that confirms with the password asks `accountHasPassword` (`lib/server/account.ts`, the `account_has_password` database function) first and has another path for an account without one, as deleting the account does; never tell from `user.identities` alone, which doesn't change when a password is set that way.
- A game's row only holds how things stand now, so a game arriving and every change to its status, dates, rating, hours or platform is also kept in `game_events`, as is its going on or off the queue (`queued`) or the favorites (`favorite`), and its getting or losing a note (`noted`: that there is one, never its words). It is written by triggers on `games`, `playing_queue` and `favorite_games` and by nothing else: no route records history itself. The rules are written out above the triggers in `supabase/schema.sql`, and `supabase/migrations/20261117_history_fixes.sql` defines all of it in one file (the one to run again if the history is ever in doubt; the history migrations before it must not be run again by themselves). In short: a Steam import is not recorded as arrivals (a game Steam reports later is: it was bought since); changes to a game within 30 seconds of each other are one event holding the net change, so an action that takes several writes is one entry and one that is undone leaves none; and replaying a game's events always gives the game as it is. Recording never stops the save it rides on: a change that couldn't be recorded is noted in `game_event_failures`, which should stay empty (any row there means events are missing). Nothing reads the history yet but the JSON export. Whatever does: reads time played with `playsOf` (`lib/account/history.ts`), never by adding up hours (moving a game between platforms replaces its hours, which is why hours always change in the same write as the platform: see `steamHoursOf`); counts a finish by its date being set, not by the status becoming finished (a game moved off Finished by mistake and back is the same finish); leaves out games whose `type` isn't `game` (Steam counts tools and soundtracks) and hidden ones; and takes a game's `created_at` for its arrival when it has no `added` event. A new column whose past will matter is added to `game_event_snapshot` and to the trigger's `when` condition, with a test in `supabase/tests/game-events.test.ts`.
- Every game Pick My Game or Random shows as a pick is kept in `game_picks`: how it was picked (`kind`: `questions` or `random`), what for (`mode`: `play`, or `queue` while a game is being played), the three answers, the reason and model, which pick of the sitting it was (`attempt`) and the button the player then pressed (`outcome`: `played`, `queued`, `rerolled`, null when they saw it and closed the picker without choosing, or `unseen` when the picker closed before the pick arrived). Only the server writes it, with its own key (`lib/server/picks.ts`): `/api/suggest` keeps a pick from the questions as it makes it and returns its `pickId`; the browser makes a random pick itself, so it reports it (`lib/client/picks.ts`, `/api/suggest/picks`), and reports the outcome of any pick by its id (a reroll through `/api/suggest/reroll`). Keeping a pick is best effort and never fails the pick: without the table or the key the game is still picked, just not kept. Nothing reads it yet but the JSON export. The answers aren't listed in the table, so a new answer to a question needs no migration.
- Every Undo that changes a game or the queue says it is one, and how long ago the change it undoes was made. `sinceNow()` (`lib/undo.ts`) is started when the change is made (where its toast is shown), and its answer goes with the Undo: `updateGameStatus(…, { undo: true, undoAgoMs })`, `restoreGameStatuses(games, agoMs)`, `addToQueue(id, undoAgoMs)`. The server passes it to the database (`apply_status_change` with `"undo": true` and `"ago"` on each item; `add_to_queue`). The history then takes the Undo out of the event that change is in, however late the toast was pressed (a toast waits while its tab is in the background), and never out of an older event. An Undo sent as an ordinary change more than 30 seconds later would read as a second change (a game moved from Finished to Hidden and back would look finished twice). An Undo also puts back what the change stamped: a start date, a last-played date.
- Anything that sends a request when pressed (a button, a form, an Undo) sends once per press. Guard it with a ref, not only state: `disabled={isPending}` and `if (isLoading) return` only apply from the next redraw, so a second click before then gets through. In a hook, use `useInFlight` (`src/hooks/useInFlight.ts`), keyed per game where two games can be acted on at once. In a component, use a `useRef(false)` lock (see Save in `GameDetailModal`). Release it when the request settles, so it can be tried again after a failure. Give it a test that presses two or three times inside one `act` and expects one request.
- Where a repeated request would change data (finishing, starting a game, adding to the queue), the server treats the repeat as already done instead of doing it again.
