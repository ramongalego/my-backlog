# MyBacklog

A Steam backlog tracker: sync your Steam library, pick what to play next, keep a queue, a diary of finished games and stats.

Next.js 16 (App Router, Turbopack, React Compiler), React 19, TypeScript, Tailwind v4, TanStack Query v5, Supabase (auth, Postgres with RLS).

## Commands

- `npm run dev`: dev server on http://localhost:3000
- `npm test`: Jest (not Vitest)
- `npm run lint`, `npx tsc --noEmit`, `npx prettier --check "src/**/*.{ts,tsx,css}"`
- `npm run build`

## Where things live

- `src/app/(app)/`: signed-in pages. Each has a server `page.tsx` that prefetches data, a client `View.tsx`, a `loading.tsx` and a `Skeleton.tsx` that mirrors the page layout.
- `src/app/(marketing)/`: the public landing page.
- `src/lib/data/loaders.ts` and `src/lib/data/prefetch.ts`: shared data loaders used both for the server prefetch and the client queries.
- `src/hooks/`: page-level hooks (`useGamesPage`, `useNowPlaying`, ...). Mutations invalidate React Query caches; pages read everything from React Query.
- `supabase/schema.sql` and `supabase/migrations/`: the database. The user applies migrations by hand.

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
