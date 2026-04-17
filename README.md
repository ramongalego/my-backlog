# my-backlog

A full-stack web app that helps Steam players stop doomscrolling their library and actually finish a game. It ingests your full Steam backlog, enriches it with HowLongToBeat data and Bayesian-smoothed review scores, and uses an LLM to recommend what to play next based on your mood, energy, and available time. It also gives you a drag-and-drop playing queue, a completion diary, share-ready completion cards rendered as dynamic OG images, and a public "Steam roast" tool.

## Tech Stack

**Framework & Runtime**
- Next.js 16 (App Router, Server Components, Route Handlers, Edge middleware)
- React 19 with the React Compiler enabled for auto-memoization
- TypeScript in strict mode across ~18k LOC
- Tailwind CSS v4 via PostCSS

**Data & Auth**
- Supabase (Postgres, Row-Level Security, SSR cookie-based auth)
- Steam OpenID 2.0 via the `openid` package for library linking
- PL/pgSQL functions for atomic server-side operations

**Intelligence**
- OpenAI SDK (`gpt-4o-mini`) for mood-aware game recommendations
- Custom tag-affinity learning computed from the user's completion history

**Client State & Interaction**
- TanStack Query v5 for server-state caching, invalidation, and optimistic updates
- dnd-kit (core, sortable, utilities) for accessible drag-and-drop reordering
- Zod v4 for runtime validation on every API boundary
- Sonner for toasts, canvas-confetti for completion celebrations, lucide-react for icons
- react-day-picker for scheduling controls

**Observability & Ops**
- Sentry (with a `/monitoring` tunnel route and custom event scrubbing)
- Vercel Analytics
- Vercel Cron for scheduled metadata refresh

**Testing**
- Jest 30 on jsdom, Testing Library (React + user-event), v8 coverage
- ~35 suites covering hooks, prompt construction, scoring, carousel dedup, auth validation, and page-level integration flows

## Architecture & System Design

### App Router Layout

Routes are split by concern under `src/app`. The landing page and the public `/roast` route are unauthenticated. `/home`, `/games`, `/playing-queue`, `/diary`, and `/stats` are gated. Every navigable route ships a matching `loading.tsx` skeleton so Suspense boundaries render instantly while data streams in. Layouts are Server Components; pages drop to `'use client'` only where they depend on hooks.

### Edge Middleware, Auth, and CSRF

`src/proxy.ts` runs as Next.js middleware on every request. It does four things in one pass:

1. Refreshes the Supabase JWT via the SSR adapter so auth cookies stay valid.
2. Enforces route protection, redirecting unauthenticated traffic away from gated paths.
3. Performs origin-based CSRF defense on mutating API calls (POST, PATCH, DELETE), rejecting any request whose `Origin` does not match the host. It intentionally tolerates a missing `Origin` so server-to-server callers (crons, internal jobs) can still reach protected endpoints with a bearer token.
4. Redirects authenticated users away from the landing page into `/home`.

Steam linking is a separate OpenID 2.0 flow. `/api/steam/auth` constructs the assertion, `/api/steam/callback` verifies it, and the resolved 64-bit Steam ID is stored on the user's profile so downstream RLS policies can scope queries by `auth.uid()`.

### Data Model and Row-Level Security

The schema is intentionally split between **per-user state** and a **shared, deduplicated metadata cache**.

- `games` holds per-user library rows: status (`backlog`, `playing`, `finished`, `dropped`, `wont_play`), Steam playtime, user rating, completion timestamps.
- `playing_queue` stores ordered queue entries scoped to `user_id`.
- `game_metadata` is a globally shared, read-only cache keyed by `app_id`. It holds genres, tags, review counts, Bayesian-smoothed review scores, and HowLongToBeat main-story hours. Because it is shared, enriching one user's library warms the cache for everyone.
- `shared_completions` powers public completion cards. RLS allows public SELECT (so share URLs resolve without auth) but INSERT and DELETE only for the owning user.

RLS policies on `games` and `playing_queue` restrict every row to `user_id = auth.uid()`. `game_metadata` is readable by authenticated users and writable only by the service role used during sync.

### Atomic Queue Reordering in PL/pgSQL

Drag-and-drop reordering cannot be done client-side with naive `UPDATE` statements because position columns have a `UNIQUE` constraint and any intermediate state violates it. The app exposes a `reorder_playing_queue(p_order bigint[])` PL/pgSQL function that:

- Validates the submitted order has the same length as the user's current queue, with no duplicates and no missing app_ids. Validation failures throw typed Postgres errors (P0001, 22023) that the client parses into user-visible messages.
- Performs the reorder in a single `UPDATE ... FROM unnest(...)` statement, relying on Postgres' deferred uniqueness check to avoid transient violations inside the transaction.
- Runs with `SECURITY INVOKER`, so RLS still applies. A user cannot reorder another user's queue even if they forge the payload.

### Metadata Enrichment with Exponential Backoff

When a Steam library lands, thousands of games may need HLTB and review data. The sync pipeline is two-staged:

1. **Bulk cache probe.** A single POST to `/api/games/sync/bulk` returns hits from `game_metadata` in one round trip.
2. **Fallback fetch.** Misses are batched six at a time against the individual sync endpoint, which resolves HLTB + review data and upserts with `onConflict: 'app_id'` so concurrent users don't clobber each other.

Missing HLTB records are common (obscure titles aren't in the database). Rather than hammering HLTB forever, each `game_metadata` row tracks an `hltb_attempts` counter that drives an exponential backoff schedule (3d, 7d, 14d, 30d, 90d). A `synced_at` column plus a 90-day TTL keeps review scores fresh. A composite index on `(type, main_story_hours, synced_at)` makes the weekly refresh cron cheap.

### AI Suggestion Engine

`/api/suggest` accepts a structured intent (mood, energy, time) plus optional exclusion lists. The route does more than wrap a prompt:

- **Candidate filtering.** Backlog games are pre-filtered by the requested time commitment before any tokens are sent. A "short" request caps main-story hours at 12, cutting the candidate set and the prompt size substantially.
- **Taste signal construction.** The route loads up to 30 finished games grouped by rating (Loved 8-10, Liked 5-7, Disliked <5) and up to 20 dropped games. It then computes **tag affinities** by comparing finish rates per tag across the user's history, so the model sees "completes strategy games 82% of the time, drops roguelikes 60% of the time" rather than just a list.
- **Weighted sorting.** Candidates are sorted by a Bayesian-smoothed Steam review score so the model sees strong games first, which matters under the 300-token response budget.
- **Reroll state.** The `useSuggestion` hook tracks `excludedAppIds` and `previousReasonings` in refs. On reroll, the previous suggestion is excluded and the prior reasoning is fed back in so the model has to genuinely change its mind. A 15-second cooldown throttles rapid cycling.
- **Post-hoc verification.** The model returns an `app_id` + reasoning. The server parses it with a regex, verifies the ID is actually in the user's backlog (not hallucinated), and hydrates the full metadata before responding.

### Client State with TanStack Query

The QueryClient is configured with a 60-second stale time, 10-minute GC time, refetch-on-focus, and single retry. Keys are hierarchical (`games.all → games.library(userId) → games.carousels(userId)`) so a single `invalidateQueries({ queryKey: games.all })` blows away every derived view.

Hooks compose rather than duplicate. `useGameLibrary` orchestrates auth, library sync, and carousel derivation. `useCarouselPools` deduplicates games across carousels client-side via a shared `Set<app_id>` so a 3-hour Hidden Gem doesn't show up in three rails at once. `useCurrentGame` uses `setQueryData` for optimistic updates: picking a game flips the UI immediately and only reverts if the server call fails.

### Drag-and-Drop Queue

The playing queue page uses `DndContext` + `SortableContext` with vertical sorting strategy. Sensors include `PointerSensor` (8px activation distance to avoid accidental drags on taps) and `KeyboardSensor` with arrow-key and Space support so the feature is fully keyboard-accessible. The `DragOverlay` renders a ghost preview with shadow and scale. On drop, positions are recomputed via `arrayMove` and PATCHed to `/api/queue`, which invokes the atomic reorder function described above.

### Security Hardening

The most recent security pass added multiple overlapping defenses:

- **CSP and security headers** configured in `next.config.ts`: strict `default-src 'self'`, whitelist of Steam CDNs for images, Supabase realtime for `connect-src` (including `wss://`), `frame-ancestors 'none'` to block clickjacking, `object-src 'none'`, plus `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` that disables camera, microphone, and geolocation.
- **SSRF hardening** on every endpoint that accepts an image URL. `isAllowedImageHost()` enforces an HTTPS + Steam CDN hostname allowlist. It is checked on write (the share creation route) and on read (the dynamic OG image route), since `next/og` fetches server-side and a rogue URL would otherwise be an SSRF vector.
- **Constant-time comparison** via Node's `timingSafeEqual` for every bearer-token check, preventing timing side-channels on internal auth.
- **Zod schemas** on every request body with explicit upper bounds: max 200 excluded app_ids, max 5 prior reasonings at 500 chars each, ratings clamped 0-10, playtime capped, share game names capped at 200 chars. Everything goes through `safeParse` with typed error responses.
- **Sentry scrubbing** strips `authorization`, `cookie`, `x-api-key`, IP headers, query strings, and any body field matching `password`, `token`, `apiKey`, or `email` before events leave the server.
- **Origin-based CSRF** in middleware (see above).
- **Console stripping** in production builds removes `console.log` while keeping `console.error` and `console.warn`.

### Rate Limiting with a Circuit Breaker

An in-memory token-bucket limiter (`lib/rate-limit.ts`) runs per endpoint with differentiated caps: 60/min on status updates, 500/min on individual game sync, 10/min on bulk sync, 10/hour on manual Steam refresh, 20/min on AI suggestions, and 10/hour per IP on public roasts. A 60-second sweep evicts expired entries and a 10k-entry soft cap with LRU eviction keeps serverless memory bounded.

The public roast feature has an additional **global circuit breaker** of 500 fresh generations per day. Per-IP limits prevent one actor from burning budget; the global cap bounds worst-case OpenAI spend even if per-IP limits are somehow bypassed.

### Observability

Sentry is integrated via `@sentry/nextjs` with a rewrite to `/monitoring` so ad-blockers don't drop events. Source maps upload with `widenClientFileUpload: true` for usable stack traces, and Vercel Cron Monitors are auto-instrumented. All events pass through the custom scrubber before send. Vercel Analytics tracks page views and custom events (game picked, finished, dropped) via an async script that doesn't block rendering.

### Performance Engineering

- **React Compiler** enabled through a Babel plugin, removing most manual `useCallback`/`useMemo` churn while preserving render performance.
- **Two-stage sync** (bulk probe then batched fallback) keeps a 500-game initial import to a handful of round trips.
- **Optimistic updates** on every mutating interaction, with query invalidation as the correctness fallback.
- **Next.js Image** with AVIF/WebP negotiation and explicit `sizes` attributes for responsive loading; Steam CDN allowlisted in `remotePatterns`.
- **Loading skeletons** on every route to pin layout and prevent CLS.
- **ISR** on the landing page and on shareable completion OG images so public URLs are served from cache.

### Accessibility

A skip-to-content link, semantic landmarks (`<main id="main-content">`), proper heading hierarchy, ARIA labels on every icon-only control, full keyboard support for queue reordering (arrow keys + Space via dnd-kit's `KeyboardSensor`), and associated labels + inline error messaging on every form field.

### Testing

Jest 30 on jsdom with Testing Library. `jest.setup.ts` polyfills `IntersectionObserver` and `ResizeObserver` so components using them render under test. Suites cover:

- Prompt construction (candidate filtering, tag-affinity rendering, time bucketing)
- Bayesian score computation and 90-day metadata freshness
- Carousel deduplication and hidden-gem selection
- OpenID state verification and Steam ID parsing
- Hook-level logic: `useStats`, `useGamesPage`, `useSuggestion`
- Page-level integration: home rendering, suggestion wizard, game detail modal status transitions

Fake timers are used for freshness tests; Supabase queries are mocked at the client boundary.
