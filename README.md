# MyBacklog

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

## Architecture & System Design

### App Router Layout

Routes are split by concern. Public routes include the landing page and `/roast`; everything else is gated. Every route ships a matching `loading.tsx` skeleton so Suspense boundaries render instantly. Layouts are Server Components; pages drop to `'use client'` only where they depend on hooks.

### Edge Middleware, Auth, and CSRF

Next.js middleware refreshes the Supabase JWT, enforces route protection on gated paths, performs origin-based CSRF defense on mutating requests, and redirects authenticated users off the landing page.

Steam linking is a separate OpenID 2.0 flow. The resolved 64-bit Steam ID is stored on the user's profile so downstream RLS policies can scope queries by `auth.uid()`.

### Data Model and Row-Level Security

The schema is split between **per-user state** (library, queue, shared completions) and a **shared, deduplicated metadata cache** keyed by `app_id`. Enriching one user's library warms the cache for everyone. RLS restricts per-user rows to `auth.uid()`; the metadata cache is readable by authenticated users and writable only by the service role used during sync.

### Atomic Queue Reordering in PL/pgSQL

Drag-and-drop reordering can't be done with naive `UPDATE` statements because position columns have a `UNIQUE` constraint and any intermediate state violates it. A PL/pgSQL function validates the submitted order and performs the reorder in a single `UPDATE ... FROM unnest(...)` statement, relying on Postgres' deferred uniqueness check. It runs with `SECURITY INVOKER`, so RLS still applies and a user can't reorder another user's queue even if they forge the payload.

### Metadata Enrichment

Sync is two-staged: a bulk cache probe against `game_metadata` in one round trip, then a batched fallback fetch for misses that resolves HLTB + review data and upserts on `app_id` conflict. Missing HLTB records are tracked with an attempt counter driving an exponential backoff, and a TTL keeps review scores fresh via a weekly refresh cron.

### AI Suggestion Engine

`/api/suggest` accepts a structured intent (mood, energy, time) plus optional exclusion lists. Backlog games are pre-filtered by the requested time commitment before any tokens are sent. The route derives **tag affinities** from the user's finish and drop history so the model sees taste signal rather than a raw list, and candidates are sorted by a Bayesian-smoothed Steam review score so strong games appear first under a tight response budget. On reroll, prior suggestions and reasonings are fed back in so the model genuinely changes its mind. The server verifies the returned `app_id` is actually in the user's backlog before hydrating metadata and responding.

### Client State with TanStack Query

Keys are hierarchical so a single `invalidateQueries` at the root blows away every derived view. Hooks compose rather than duplicate: `useGameLibrary` orchestrates auth, library sync, and carousel derivation; `useCarouselPools` deduplicates games across carousels client-side; `useCurrentGame` uses `setQueryData` for optimistic updates that only revert if the server call fails.

### Drag-and-Drop Queue

The playing queue uses dnd-kit with pointer and keyboard sensors so reordering is fully keyboard-accessible. On drop, positions are recomputed client-side and PATCHed to the queue endpoint, which invokes the atomic reorder function described above.

### Security Hardening

Multiple overlapping defenses:

- **CSP and security headers**: strict `default-src`, image/connect allowlists, `frame-ancestors 'none'`, `X-Content-Type-Options`, `Referrer-Policy`, and a `Permissions-Policy` that disables camera, microphone, and geolocation.
- **SSRF hardening** on every endpoint that accepts an image URL via a hostname allowlist, checked on both write and read paths.
- **Constant-time comparison** for bearer-token checks.
- **Zod schemas** on every request body with explicit upper bounds and typed error responses.
- **Sentry scrubbing** strips auth headers, cookies, IP headers, query strings, and sensitive body fields before events leave the server.
- **Origin-based CSRF** in middleware.
- **Console stripping** in production builds.

### Rate Limiting

Per-endpoint token-bucket limiters with differentiated caps tuned to typical usage, plus a global circuit breaker on the public roast feature to bound worst-case spend if per-IP limits are bypassed.

### Observability

Sentry is integrated with a tunnel rewrite so ad-blockers don't drop events, source maps upload for usable stack traces, and all events pass through the custom scrubber before send. Vercel Analytics tracks page views and custom events (game picked, finished, dropped).

### Performance Engineering

- **React Compiler** for auto-memoization without manual `useCallback`/`useMemo` churn.
- **Two-stage sync** keeps large initial imports to a handful of round trips.
- **Optimistic updates** on every mutating interaction, with query invalidation as the correctness fallback.
- **Next.js Image** with AVIF/WebP negotiation and responsive `sizes`.
- **Loading skeletons** on every route to prevent CLS.
- **ISR** on the landing page and shareable completion OG images.

### Accessibility

Skip-to-content link, semantic landmarks, proper heading hierarchy, ARIA labels on icon-only controls, full keyboard support for queue reordering, and associated labels + inline error messaging on every form field.
