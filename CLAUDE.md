# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
npm run dev       # Start dev server at http://localhost:5173
npm run build     # Production build (runs tsc then vite build)
npm run lint      # ESLint
npm run preview   # Serve the production build locally
```

There is no test runner configured.

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

> **Important:** The active nav is `src/components/shell/NavPanel.tsx`. `src/components/layout/Sidebar.tsx` is an alternate/legacy component that is **not wired into Layout.tsx** — edits to the sidebar appearance should go to `NavPanel.tsx`.

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
