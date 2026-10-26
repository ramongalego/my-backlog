---
name: MyBacklog
description: A Steam backlog tracker that helps you pick a game and actually finish it.
colors:
  # Source of truth: the @theme block in src/app/globals.css (OKLCH). Hex is for reference.
  ink-50: "oklch(0.97 0.004 75)" # #f7f5f2
  ink-100: "oklch(0.93 0.005 75)" # #eae7e4
  ink-200: "oklch(0.87 0.006 75)" # #d6d4d0
  ink-300: "oklch(0.79 0.007 70)" # #bdbab6
  ink-400: "oklch(0.71 0.008 70)" # #a5a19c
  ink-500: "oklch(0.63 0.009 65)" # #8d8884
  ink-600: "oklch(0.47 0.01 65)" # #5f5a55
  ink-700: "oklch(0.37 0.01 65)" # #443f3a
  ink-800: "oklch(0.28 0.009 65)" # #2c2824
  ink-900: "oklch(0.215 0.008 65)" # #1c1916
  ink-950: "oklch(0.16 0.006 65)" # #0f0d0b
  accent-300: "oklch(0.83 0.12 54)" # #ffb17a
  accent-400: "oklch(0.77 0.155 50)" # #ff9451
  accent-500: "oklch(0.715 0.175 46)" # #f97934
  finished: "#10b981" # Tailwind emerald-500
  dropped: "#f43f5e" # Tailwind rose-500
  rating: "#fbbf24" # Tailwind amber-400
typography:
  page-title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  section-title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
  panel-title:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
  body:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  meta:
    fontFamily: "Schibsted Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  gutter: "16px"
  gutter-sm: "24px"
  page-top: "96px"
components:
  button-primary:
    backgroundColor: "{colors.accent-500}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.lg}"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.accent-400}"
  button-secondary:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.ink-100}"
    rounded: "{rounded.lg}"
    height: "40px"
  panel:
    backgroundColor: "{colors.ink-900}"
    rounded: "{rounded.xl}"
    padding: "24px"
  chip-selected:
    backgroundColor: "{colors.ink-100}"
    textColor: "{colors.ink-950}"
    rounded: "{rounded.lg}"
    height: "32px"
  chip:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.ink-300}"
    rounded: "{rounded.lg}"
    height: "32px"
  field:
    backgroundColor: "{colors.ink-800}"
    textColor: "{colors.ink-100}"
    rounded: "{rounded.lg}"
    height: "40px"
---

# Design System: MyBacklog

## Overview

**Creative North Star: "The Lamp-Lit Shelf"**

MyBacklog is a shelf of games you own, looked at in the evening. The room is dark and warm (graphite neutrals with a slight brown tint, never pure black or cold blue-grey), the game art supplies almost all the colour, and one ember-orange lamp marks what matters right now: the button to press, the page you're on, the game you're playing.

It is a tool first (the Operate mode in Impeccable's terms). Familiar controls, consistent components and calm surfaces beat novelty. Personality lives in a few precise details: the warm neutrals, the orange accent, the box-art shelf on the landing page, the cover-art tiles.

Explicitly rejected: the generic "AI app" look this project used to have. That means violet or purple accents, gradient text, glowing blobs or orbs, floating particles, pulsing dots, glassmorphism, small uppercase "kicker" labels, icon-in-a-rounded-square tiles, and cards nested inside cards.

**Key characteristics:**
- Dark, warm, flat. Depth comes from tone, not shadows.
- One accent colour, used sparingly.
- Game art is the hero. The interface frames it and stays out of the way.
- Sentence-case headings, no tracking-widened uppercase labels.

## Colors

Warm graphite neutrals ("ink") plus a single ember-orange accent, with three semantic colours that only ever mean one thing.

### Primary
- **Ember** (`accent-500`, #f97934): primary buttons (`<Button>`), the current-page underline in the header, the "Playing" status, progress toward the time to beat. Text on solid ember is always `ink-950`, never white.
- **Ember Light** (`accent-400`): hover for primary buttons, accent text on dark (e.g. "Playing now"), the focus outline.

### Semantic
- **Finished** (emerald-500 / emerald-400 for text): finished games, completion bars.
- **Dropped** (rose-500 / rose-400 for text): dropped games and every error message.
- **Rating** (amber-400): star ratings only.

All status colours come from `STATUS_STYLE` in `src/lib/games/status-style.ts`. Never hand-pick a colour for a status.

### Neutral
- **Ink 950** (#0f0d0b): page background.
- **Ink 900** (#1c1916): panels, modals, the raised surface.
- **Ink 800** (#2c2824): chips, secondary buttons, fields, dividers, inactive bar tracks.
- **Ink 700/600**: hover borders, scrollbars, quiet icons.
- **Ink 500** (#8d8884): the dimmest text allowed (meta rows, counts). Passes 4.5:1 on ink-950 and ink-900.
- **Ink 400** (#a5a19c): secondary text and descriptions.
- **Ink 300–200**: labels, body text inside panels.
- **Ink 100–50**: headings and primary text.

### Named Rules
**The One Lamp Rule.** Orange marks the action, the current place or the current game. It is not decoration: no orange icons for flavour, no orange section headings, no orange data series that aren't "playing".

**The Ink 500 Floor.** No text dimmer than `ink-500`. `ink-600` and below are for icons, borders and disabled states only.

**One Meaning Per Colour.** Green is finished, red is dropped or an error, amber is a rating. A new feature that needs a new meaning gets a new colour token here first.

## Typography

**Font:** Schibsted Grotesk (via `next/font`, exposed as `font-sans`), with the system sans as fallback. One family for everything.

**Character:** a sturdy newspaper grotesk that stays legible at small sizes and gives headings some character without a separate display face.

### Hierarchy
- **Display** (600, `text-5xl md:text-6xl`, tight leading, `tracking-tight`): landing page hero only.
- **Page title** (600, `text-2xl sm:text-[1.75rem]`, `tracking-tight`, ink-50): one per page, via `<PageHeader>`.
- **Section title** (600, `text-lg sm:text-xl`, `tracking-tight`, ink-50): carousels and other page sections. Landing sections use `text-3xl md:text-4xl`.
- **Panel title** (600, `text-sm`, ink-200): the heading inside a panel, via `<SectionLabel>`.
- **Body** (400, 16px, ink-200 to ink-400): descriptions and prose; keep prose to about 65ch.
- **Meta** (400, `text-xs`, ink-500): time to beat, review score, counts.

### Named Rules
**The No Kicker Rule.** Never put a small uppercase, letter-spaced label above a heading. The heading carries itself. State such as "Playing now" goes below the title.

**The Tabular Columns Rule.** Use `tabular-nums` only where numbers line up in a column (counts, queue positions, right-aligned values). Big standalone figures stay proportional.

Headings get `text-wrap: balance` and paragraphs `text-wrap: pretty` globally.

## Layout

- **Container:** `PAGE_CONTAINER` (`max-w-7xl mx-auto px-4 sm:px-6`). Marketing sections use `max-w-6xl` with the same gutters.
- **Page frame:** `<Page>` sets the top offset under the fixed header (`pt-20 sm:pt-24`) and bottom padding (`pb-16`). Every signed-in page starts with `<PageHeader>`.
- **Rhythm:** tight inside groups, generous between them. Typical values: `gap-2` inside a control group, `gap-4` to `gap-6` between panels, `space-y-12` between home sections, `mb-8` under the page header.
- **Grids:** game grids are 2 columns on phones, 3 at `md`, 4 at `lg`. Panel grids go 1 column, then 2 at `lg`.
- **Responsive is structural:** stack columns, wrap or scroll chip rows, hide secondary text. Type sizes step once at `sm`; no fluid type in the app.
- **No horizontal page scroll** at any width down to 360px.

## Elevation & Depth

Flat by default. Depth is tonal: the page is ink-950, a panel is ink-900, and a control inside a panel is ink-800. Panels have no border and no shadow.

The exceptions are things that float above the page: modals (`border-ink-800` on ink-900, over a 75% black backdrop), dropdown menus and tooltips (`border-ink-700` with a soft black shadow), and a dragged queue row (`shadow-xl shadow-black/40`).

### Named Rules
**The Declare-It-Once Rule.** A surface gets either a tone change, a border or a shadow as its elevation, not all three. Never a coloured glow.

## Shapes

- `rounded-md` (6px): small chips, status badges and list thumbnails.
- `rounded-lg` (8px): buttons, fields, chips, game tiles.
- `rounded-xl` (12px): panels and the large "now playing" cover.
- `rounded-2xl` (16px): modals only.
- `rounded-full`: progress bars, legend dots, round icon buttons.

Every game image uses the Steam header ratio, 460:215 (`COVER_ASPECT`), with a hairline inner ring (`ring-white/8`) so dark art doesn't melt into the page. Box art on the landing page is 2:3.

## Components

Reach for these before writing new markup. If a pattern repeats a second time, it becomes a component here.

**Layout:** `src/components/layout/`
- `Page`, `PageHeader` (title, description, actions, toolbar), `SectionLabel` (panel and section titles), `PAGE_CONTAINER`.
- `Skeleton`, `PageSkeleton`, `PageHeaderSkeleton`, `PanelSkeleton`. Every page has a `loading.tsx` whose skeleton mirrors the real layout (same container, header and panel sizes), so nothing shifts when data arrives.

**UI primitives:** `src/components/ui/`
- `Button`: `primary` (one per view, the main action), `secondary`, `ghost`, `success`, `danger`; sizes `sm` (32px), `md` (40px), `lg` (48px). Use `isLoading` for in-flight actions. Never hand-roll an accent button.
- `Panel`: the raised surface. Padding `md` (default), `sm` or `none`. Use instead of `bg-ink-900 rounded-xl`.
- `ToggleGroup`: pick-one controls. `chips` for filters and choices (selected is light `ink-100`, not orange), `segmented` for a small switch in a panel header. Supports counts.
- `EmptyState`: icon, title and a sentence that teaches what will appear here and how.
- `Input`, `fieldClass()`, `FIELD_LABEL`: every text field, textarea and search box. Focus brightens the border; it doesn't turn orange.
- `Modal`, `Dropdown`.
- `Tooltip` / `TooltipText`: instant custom tooltip for compact indicators (hover or tap). It renders at page level, so clipping containers can't cut it off. Triggers aren't tab stops (the text reaches screen readers via `aria-describedby`), so keep anything essential visible. Never use the native `title` attribute for this.

**Games:** `src/components/games/`
- `CoverArt` / `GameArt`: any game image at the 460:215 ratio. Games added by hand without wide art use their tall box art, drawn whole over a blurred, enlarged copy of itself (`GameArt`): the one sanctioned blur, because it fills the frame rather than decorating it. `interactive` brightens the edge on hover, `CoverEditHint` adds the hover pencil, and `CoverThumb` is the small size for list rows.
- `StatusBadge`: status chip on art and in lists. Backlog is the default and shows no badge unless `showBacklog` is set.
- `GameCard` (grid tile: art with title and meta underneath, no box), `GameMetaRow` / `GameCardInfo`.
- `GameCarousel`: a Netflix-style row. With a mouse on a wide screen it shows whole pages (2, 3, 4 or 5 cards by width) and loops endlessly. The next card always peeks in under a right-edge fade, so the row reads as "more" without hovering, and it becomes the first card of the next page. Arrows sit over the edges of the art and appear on hover or keyboard focus (the next arrow covers the peeking card; the left one appears after the first move). On phones and touch screens it's a native swipe row with the next card peeking in. Only on-screen cards are reachable by keyboard.
- `TimeToBeat`, `SteamScore`, `Playtime`, `SteamDeckBadge`: the meta-row indicators (clock + hours to beat, thumbs-up + percent, history icon + hours played, status icon + "Deck"), each with its tooltip. In a meta row they're always icon + value so a row fits on one line on narrow cards; `Playtime` adds the word "played" whenever there's room (a meta row 16rem or wider, via a container query; always on the Diary, playing cards and Stats), since its icon alone is easy to confuse with time-to-beat's clock.
- `GameDetailModal`: the one dialog for a game, art header first. It also adds games from outside Steam (`adding`): search in `AddGameModal`, then the game opens here with `ConsolePicker`, the same status grid (finished games get their date, rating and notes) and "Add to library". Games added by hand get hours played and Remove (`manual`) wherever the dialog opens.
- `ConsoleBadge`: the console a game added by hand is on (or a Steam game was moved to, by adding it from another console), as a chip on its art (`CoverArt`'s `platform`, bottom-left; top-left in the detail dialog, where the title runs along the bottom). Its short name as text, in neutral ink like every other chip on art; no logos, and no colour per console, which would compete with the status colours. The chip is hidden from screen readers; the meta row carries the name as `sr-only` text. Steam games show none.
- `STATUS_STYLE` and `GAME_STATUSES` in `src/lib/games/status-style.ts`: label, icon, text, solid and fill classes for every status.

**Interaction states:** every control needs hover, keyboard focus (the global `:focus-visible` orange outline covers buttons and links; it lives in the base layer, so a component can replace it, as text fields do with their border), disabled and loading states. A disabled primary button goes neutral grey rather than faded orange.

**Motion:** 150–250ms colour and opacity transitions. Motion shows a change of state; it is never ambient decoration. Respect `prefers-reduced-motion` (handled globally).

## Writing

Copy reads like a person who plays games wrote it: plain, specific and short. Say what the thing does or what happened, then stop.

- Prefer the concrete detail ("imports your Steam library", "57h to beat") over the claim ("seamless", "smart", "the perfect game").
- Avoid the words AI copy leans on: perfect, seamless, effortless, finally, actually, simply, surface, unlock, elevate, journey, dive in, at a glance, ready to go.
- No slogan pairs ("Stop X. Start Y."), reflexive lists of three, or setups like "You know the drill:".
- No capitals or exclamation marks for emphasis. One exclamation mark is fine for a real celebration ("You finished it!").
- No em dashes in UI copy; use a comma, colon or full stop.
- Prompts that generate text people read (Pick My Game reasons, roasts) spell out the same rules, since models fall back on these habits.

## Do's and Don'ts

**Do**
- Use the shared components above; extend one with a prop before creating a near-copy.
- Keep orange for the primary action, the current page and "playing".
- Let game art carry the colour. Use neutral chrome around it.
- Write empty states and errors in plain language that says what happened and what to do next.
- Build the skeleton alongside the page, and check the page at phone width.
- Use `ink-*` and `accent-*` tokens, never raw hex or Tailwind's `zinc`, `violet` and so on.

**Don't**
- Gradient text, glows, orbs, particles, pulsing dots, glass or blur as decoration (the box-art backdrop in `GameArt` is the one exception: it fills space, it doesn't decorate).
- Kicker labels, uppercase letter-spaced labels, or numbered section markers.
- Cards inside cards, borders plus shadows on the same panel, or coloured side stripes.
- Icons inside rounded-square tiles as a layout device, or a rainbow of icon colours.
- Rows of identical "big number + label + icon" stat cards. Group figures in one strip instead.
- White text on orange, or text dimmer than `ink-500`.
- A modal where an inline control would do.
