# MyBacklog

A full-stack web app that helps players stop scrolling their library and actually finish a game. It imports your Steam library (and games you add from any console), enriches every game with HowLongToBeat times, critic and Steam review scores, and picks what to play tonight from your mood, energy and free time. Around that: a drag-and-drop playing queue, a diary of finished games, stats on where your hours went, a written profile of you as a player (or a roast of you), and shareable completion cards rendered as Open Graph images.

## Features

- **Pick My Game**: three questions (mood, energy, time), then a pick from your own backlog with a short reason, or leave it to chance.
- **Playing queue**: drag to reorder (pointer or keyboard), move to top, and switch what you're playing from anywhere in one tap, with Undo.
- **Library**: Steam games synced with playtime, plus games from any console via IGDB; search, filters, sort, and a detail dialog for every game.
- **Diary and stats**: finished games with date, rating and notes; hours played, backlog pace, favourites and what you tend to finish. Once the library says enough, Stats can write what it says about you as a player, or roast you with the same facts.
- **Sharing**: a public page and Open Graph image for each finished game.

## Tech stack

| Area             | Choice                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router, Server Components, route handlers, Turbopack), React 19 with the React Compiler |
| Language         | TypeScript (strict), ~25k lines                                                                         |
| Styling          | Tailwind CSS v4, a small design system documented in [`DESIGN.md`](DESIGN.md)                           |
| Data and auth    | Supabase: Postgres with row-level security, cookie-based SSR auth, PL/pgSQL for atomic operations       |
| Client state     | TanStack Query v5: server prefetch and hydration, optimistic updates, targeted invalidation             |
| Validation       | Zod v4 on every API request body                                                                        |
| Outside services | Steam Web API and OpenID 2.0, IGDB, HowLongToBeat, SteamGridDB, OpenAI                                  |
| UI pieces        | dnd-kit (accessible drag and drop), lucide-react, Sonner, react-day-picker, canvas-confetti             |
| Testing and CI   | Jest and React Testing Library (809 tests), GitHub Actions                                              |
| Hosting          | Vercel, with Vercel Analytics                                                                           |

## Getting started

**You need** Node 22 or later, a [Supabase](https://supabase.com) project, and the API keys listed in [`.env.example`](.env.example).

1. **Install:**

   ```bash
   npm install
   ```

2. **Create the database.** In the Supabase SQL editor, run [`supabase/schema.sql`](supabase/schema.sql). It's the full current schema (tables, row-level security, functions); [`supabase/migrations/`](supabase/migrations) holds the history of changes since it was first created.

3. **Configure:** copy `.env.example` to `.env` and fill it in. Steam, OpenAI and IGDB keys are needed for importing, picking and adding console games; SteamGridDB is optional.

4. **Run:**

   ```bash
   npm run dev
   ```

   The app is at http://localhost:3000.

### Scripts

| Command                | What it does                                                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run dev`          | Development server                                                                              |
| `npm test`             | All Jest tests                                                                                  |
| `npm run lint`         | ESLint                                                                                          |
| `npx tsc --noEmit`     | Typecheck                                                                                       |
| `npm run build`        | Production build                                                                                |
| `npm run check:unused` | Unused files, exports and dependencies ([knip](https://knip.dev); also runs in CI)              |
| `npm run check:hltb`   | Looks real games up on HowLongToBeat, to catch site changes (also runs daily in GitHub Actions) |

## Project structure

```
src/
├── app/
│   ├── (app)/<page>/          Signed-in pages: page.tsx (server prefetch), View.tsx,
│   │                          loading.tsx and Skeleton.tsx for each
│   ├── (marketing)/           The public landing page
│   └── api/                   Route handlers, each with its route.test.ts beside it
├── components/
│   ├── <page>/                One page's pieces, one component per file
│   │                          (home, queue, diary, stats, landing, suggest)
│   ├── games/                 Shared game UI: art, cards, the game detail dialog
│   ├── layout/ ui/            The app's frame, and buttons, panels, menus, tooltips
│   └── sync/                  Steam library sync and its progress
├── hooks/                     use<Page>Page for each page; shared ones by what they do
│                              (useNowPlaying, useQueue, useSwitchGame, useGameMutations)
├── lib/
│   ├── client/                Browser code that calls the app's API
│   ├── server/                Server-only logic, each file marked 'server-only'
│   ├── data/                  Loaders shared by server prefetch and client queries
│   ├── steam/ igdb/ hltb/     Outside services
│   ├── steamgriddb/ supabase/
│   └── games/ suggest/ …      Pure rules and helpers that run anywhere
└── types/
supabase/                      schema.sql and migrations
```

The rules behind it:

- **A page's `View.tsx` only wires things together** (data, dialogs, empty and loading states). What it draws lives in `components/<page>/`.
- **Files are named for what they export.**
- **Tests sit next to the file they test.**
- **`lib/` is split by where code runs.** Importing anything from `lib/server/` into a component fails the build.

## How it fits together

**Loading a page.** `page.tsx` runs on the server and prefetches the page's data with the loaders in `lib/data/loaders.ts`, then hands it to the browser in a TanStack Query `HydrationBoundary`. The page's hook reads the same query definitions (`lib/data/queries.ts`), so the first render uses the prefetched data, with no second fetch and no loading flash.

**Changing something.** Taking marking a game finished as the example:

1. The dialog calls the page hook.
2. The hook updates the cached data at once, then calls a function in `lib/client/`.
3. That posts to a route in `app/api/`. The route checks the session, the rate limit and the body (Zod), then calls `lib/server/` to write to Postgres.
4. When the request settles, only the queries the change touches are invalidated. On failure, the cached data is rolled back.

[`CLAUDE.md`](CLAUDE.md) traces this file by file, with a "where to look for a bug" table.

## Architecture highlights

### Auth, routing and CSRF

The app's proxy (`src/proxy.ts`, Next 16's successor to middleware):

- refreshes the Supabase session cookie on each request;
- sends signed-out visitors away from signed-in pages, and signed-in users from the landing page to Home;
- rejects cross-origin mutating API requests by checking the `Origin` header.

Steam linking is a separate OpenID 2.0 flow, whose `state` is compared in constant time. Only the server can set a profile's Steam id: users can't write it through the public API.

### Data model and row-level security

The schema separates **per-user state** (library, queue, shared completions) from a **shared metadata cache** (`game_metadata`) keyed by Steam app id: enriching one user's library warms the cache for everyone.

Row-level security limits per-user rows to `auth.uid()`. Writes that need checking (profiles, share pages, support tickets, the metadata cache) are revoked from the public API keys and go through route handlers using the server's secret key. Column limits on games mirror the forms' limits, so the database enforces them even against direct API writes.

### Atomic queue reordering

Reordering is one PL/pgSQL function, `reorder_queue`:

1. It checks the new order holds exactly the queue's games: same count, no duplicates, none from outside the queue.
2. It renumbers every row in a single `UPDATE … FROM unnest(…) WITH ORDINALITY`.

It runs with the caller's rights, so row-level security still applies, and a forged payload can't touch another user's queue.

### Switching what you're playing

Starting a game while another is playing sends one request. The server:

- starts the new game;
- pauses the current one at the top of the queue, keeping its start date;
- reports which game it actually paused, so the toast and Undo don't rely on a browser tab that may be out of date.

Finishing the new game resumes the paused one where it left off. Games that aren't out yet are never started automatically.

### Metadata enrichment

Library sync works in two stages:

1. One request checks the shared cache for every game.
2. Only the misses are fetched, in batches, from the Steam store and HowLongToBeat, then written back to the cache.

Stale entries are refreshed on a schedule. Games HowLongToBeat doesn't know are retried on a backoff (3, 7, 14, then 28 days), so sync never hammers it for the same misses. Steam review scores and header art are checked about once a day, both from the same batched store calls (50 games each), since Steam swaps art for launches and events.

The HowLongToBeat lookup has to find the site's current search endpoint, which changes now and then. A GitHub Action checks every day that it still works.

### Pick My Game

`/api/suggest` doesn't hand the model the whole backlog. It works in four steps:

1. **Filter in code.** Only games that are out, not queued, fit the time you have, and aren't a sequel whose earlier entry is still unplayed.
2. **Score the rest.** Tag fit for the mood and energy, your taste from your ratings and your finished and dropped games, series you've enjoyed, critic and Steam scores, and how recently a game was rerolled.
3. **Send a short, shuffled shortlist.** The model's structured output can only name ids from that shortlist, so it can't suggest a game you don't own.
4. **Reroll with context.** A reroll passes the earlier picks and their reasons, so the next reason doesn't repeat them.

The model (OpenAI `gpt-6-luna`) was chosen after comparing seven models on the same prompts.

The player profile on Stats (`/api/insights`) works the same way: the facts (finish rate, hours, tags finished and dropped, ratings) are worked out in code from the library on the server, sent to the model as data, and come back as a structured headline and paragraphs. Each profile is saved with a signature of the facts it used, so it is only written again when the library changes in a way it talks about.

### Client state

Query keys are hierarchical, so a change invalidates exactly what it touches. Mutations that share the queue run one at a time (a TanStack Query mutation scope), so quick successive reorders can't reach the server out of order. Every Undo restores the previous state precisely, including a game's place in the queue.

### Security

- **Content Security Policy** and security headers: `frame-ancestors 'none'`, `nosniff`, a strict referrer policy, and camera, microphone and geolocation disabled.
- **Hostname allowlists** for every image URL a user can submit, checked when saving and when rendering share images.
- **Zod schemas** on every request body, with explicit upper bounds.
- **`server-only`** on all server code, so secrets can't reach a client bundle.
- **No `console` output** in production builds, apart from errors and warnings.

### Rate limiting

Every endpoint that writes data or calls an outside service has a per-user (or per-IP) fixed-window limit. The expensive ones (AI suggestions, player profiles, Steam refreshes, share pages, support tickets) are counted in Postgres, so the limit holds across serverless instances. A global daily cap on AI suggestions and player profiles bounds the worst-case OpenAI spend.

### Performance and accessibility

- **Rendering:** the React Compiler handles memoisation. Server prefetch with hydration means no client fetch waterfalls on first load.
- **Updates and images:** changes are optimistic. Images are AVIF/WebP through `next/image` with responsive `sizes`.
- **Loading:** every page has a skeleton that mirrors its layout, so nothing shifts as it loads.
- **Accessibility:**
  - a skip link and semantic landmarks;
  - labels on every icon-only control;
  - keyboard drag and drop, with screen-reader announcements by game name and position;
  - form errors tied to their fields;
  - layouts that work at phone width.
