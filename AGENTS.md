# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Read HANDOFF.md first

Before doing anything else this session, read [HANDOFF.md](HANDOFF.md) — it's
the current project state (open threads, what just landed, what's paused),
kept up to date across machines/accounts (Claude Code and Codex both work in
this repo) so you don't have to guess or ask. This file (AGENTS.md) covers
architecture/conventions that don't change session to session; HANDOFF.md
covers what's actually going on right now. Update HANDOFF.md before ending a
session whose state has changed.

**Note:** this file's content is a near-duplicate of this repo's `CLAUDE.md`
(same architecture, kept for Codex's own convention). If you change
architecture/convention facts here, mirror the change in `CLAUDE.md` too —
they're meant to describe the same reality for two different tools.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

---

## Commands

```bash
npm run dev        # Start dev server at http://localhost:5173
npm run build      # Production build — vite only, does NOT typecheck
npm run typecheck  # Full typecheck across all three tsconfig projects
npm run lint       # ESLint
npm run preview    # Serve the production build locally
```

There is no test runner configured.

**Typechecking, and a trap.** Bare `npx tsc --noEmit` silently checks NOTHING: the
root `tsconfig.json` has `"files": []` and only project references, so there is
nothing for it to read. It exits 0 no matter how broken the code is. Use
`npm run typecheck` (build mode, all three projects) or `npm run typecheck:app`
for a faster app-only pass.

`npm run build` is Vite alone and does not typecheck, so type errors never fail a
build or a deploy. The codebase currently carries ~335 pre-existing errors, mostly
implicit-`any` in older components. Treat that number as the baseline: when
judging whether a change is clean, compare the count and confirm your own files
are absent from the output rather than expecting zero.

---

## Stack

- **React 19 + TypeScript (strict)** — all source files in `src/` are `.tsx`/`.ts`
- **Vite 8 with OXC bundler** — stricter JSX/TS parsing than tsc; TypeScript `as T` casts inside JSX attribute expressions **must be wrapped in parentheses**: `style={({ ...styles } as React.CSSProperties)}` not `style={{ ...styles } as React.CSSProperties}`. OXC will throw a parse error on the bare form even when tsc passes.
- **Tailwind v4** — configured via `@theme` in `src/index.css`; uses the `@tailwindcss/vite` plugin
- **React Router v7** — all routes declared in `src/App.tsx`
- **Recharts** — used for data visualisation in pages
- **Lucide React** — only icon library; never import from other icon sources
- **Framer Motion** — used for animations

---

## Architecture

### Shell layout

`Layout.tsx` composes three shell primitives:

```
<NavPanel />        ← collapsible nav (64 px collapsed / 208 px expanded)
<ContentColumn>     ← flex:1, fills remaining width
  <TopBar />
  <main>            ← scrollable page outlet
    <Outlet />
  </main>
</ContentColumn>
```

`GuidedTour` and `OnboardingModal` are rendered at the Layout level and sit above page content. The `AskModal` ("Ask Ariya", `/` shortcut key) is also Layout-level.

> **Important:** The nav is `src/components/shell/NavPanel.tsx` — edits to nav appearance go there. (An earlier note here described a legacy `src/components/layout/Sidebar.tsx`; that file no longer exists.)

### Global state — `AppContext`

`src/context/AppContext.tsx` is the single provider. Key slices:

| Slice | localStorage key |
|---|---|
| Watched competitors (`Set<string>`) | `pharma-inc-ciwarroom-watched` |
| Read alerts (`Set<string>`) | `pharma-inc-ciwarroom-read-alerts` |
| Onboarding complete | `onboardingComplete` |
| User role | `ariya-user-role` |
| Tracked assets (onboarding) | `trackedAssets` |

Guided tour navigates through `TOUR_ROUTES` (exported from AppContext) using `navigate()`.

### Data layer

`src/data/kalvista.ts` is the **single re-export hub** for all JSON data files. **Always import data from `kalvista.ts`**, not directly from individual JSON files:

```ts
// ✅ correct
import { competitorsData, alertsData } from '../data/kalvista'

// ❌ wrong
import competitorsData from '../data/competitors.json'
```

All data is stubbed/illustrative demo data. The persona is **David at Pharma Inc**, Head of Competitive Intelligence, tracking HAE competitors (sebetralstat launch context).

### Design tokens

CSS custom properties are declared in `src/styles/tokens.css` and exposed as Tailwind utilities via `@theme` in `src/index.css`. **No raw hex values anywhere in `src/`** — use `var(--token-name)` or the corresponding Tailwind class. RGBA strings (e.g. `rgba(255,255,255,0.12)`) are exempt from this rule.

Key token groups: `--blue-*`, `--dark-blue-*`, `--bg-1/2`, `--font-primary/secondary`, `--status-*`, `--gap-*`, `--padding-*`, `--radius-*`.

Font family is **Satoshi** (`var(--font-family)`).
