# Ariya Signals — Repository Audit Report
**Date:** 2026-06-11  
**Branch:** iteration-2  
**Auditor:** Claude Code

---

## 1. Routing

### Implementation
React Router v7 (`react-router-dom ^7.14.2`). All routes declared in `src/App.tsx`. Every page component is wrapped in `React.lazy()` for route-level code splitting.

### Route table (`src/App.tsx` lines 63–77)

| Route | Component | Notes |
|---|---|---|
| `/` | `WarRoom` | Default home |
| `/competitors` | `Competitors` | |
| `/competitors/timeline` | Redirect → `/competitors` | |
| `/competitors/:id` | `CompetitorProfile` | |
| `/intelligence` | `Portal` | |
| `/portal` | Redirect → `/intelligence` | |
| `/market-performance` | `MarketPerformance` | |
| `/pricing` | `PricingAndAccess` | |
| `/alerts` | `AlertsPage` | |
| `/myspace` | `MySpace` | |
| `/myspace/alerts` | `MyAlerts` | |
| `/myspace/documents` | `MyDocuments` | |
| `/ask` | `Ask` | |
| `/admin` | `AdminPage` | |
| `*` | `NotFound` | |

### Why direct URL navigation returns 404 on Vercel

This is a classic SPA routing problem. When a user navigates directly to `/intelligence` or refreshes the page, the browser sends a GET `/intelligence` request to the server. Since the build output is purely static files (`dist/index.html` plus assets), the server has no file at that path and returns a 404.

**Root cause:** `vercel.json` exists locally and was uploaded in the most recent `vercel --prod` CLI deployment, but it is **not committed to the git repository** (shows as `??` untracked in git status). Deployments triggered from git (e.g. via Vercel's GitHub integration) would omit it, causing 404s on all routes except `/`.

### Exact fix

`vercel.json` already exists locally with the correct content. It just needs to be committed:

```bash
git add vercel.json
git commit -m "fix(routing): commit vercel.json SPA fallback to repo"
```

Current `vercel.json` has both the SPA rewrite and security headers — no content changes needed.

---

## 2. Hardcoded Content

All persona-specific values that would need to change for a new client.

### `src/data/user.json` — primary source of truth

| Line | Key | Value |
|---|---|---|
| 2 | `company` | `"Pharma Inc"` |
| 3 | `title` | `"Head of Competitive Intelligence"` |
| 4 | `name` | `"David"` |
| 7 | `therapeuticAreas` | `["HAE"]` |

Most UI components read from this file via `kalvista.ts → userData`. This is good design — a single place to update persona.

### `src/pages/MarketPerformance.tsx` — internal placeholder text exposed to client

| Line | Content |
|---|---|
| 79–81 | `"Live market performance data will appear here via Power BI embed, aligned with the Azure data pipeline. Configuration in progress with the data engineering team."` |
| 91 | `"Contact: Ananda Ramachandra · data pipeline lead"` |

**Risk:** This text is visible to the demo client. It references an internal team member by name and exposes implementation details (Azure data pipeline, Power BI embed). Must be replaced before client distribution.

### `src/pages/WarRoom.tsx` — drug name hardcoded in JSX

| Line | Content |
|---|---|
| 33–35 | `IMPLICATION_ITEMS` array — references `"Ekterly"` and `"Sebetralstat"` inline |
| 38–40 | `WHAT_MOVED_ITEMS` array — identical content to `IMPLICATION_ITEMS` (see §5) |
| 815 | Section heading: `"Market weather · Ekterly"` |
| 29 | `const TODAY = new Date('2026-04-21')` — frozen demo date |

### `src/components/shell/TopBar.tsx` — drug and TA hardcoded in subtitle

| Line | Content |
|---|---|
| 60 | `"Ekterly · HAE · ..."` — War Room subtitle |
| 66 | `"HAE therapeutic area"` — Competitors subtitle |

### `src/data/competitors.json` — references to own company

| Approx. line | Content |
|---|---|
| 1065 | `"This is the competitive framing Pharma Inc needs to counter directly..."` |
| Multiple | References to `"HAE"` throughout as therapeutic area |
| Multiple | References to `"Ekterly"` as own product |

---

## 3. Secrets

**Result: None found.**

Scanned all files under `src/`, `public/`, root config files (`.env*`, `vercel.json`, `package.json`) for:
- `sk-` prefix (OpenAI/Anthropic API keys)
- `api_key`, `apikey`, `API_KEY`
- `Bearer` token strings
- `VITE_` and `NEXT_PUBLIC_` env var references with values
- Hardcoded credential patterns

No sensitive values found. The app makes zero API calls — all data is static JSON. No `.env` files exist in the project.

---

## 4. Dead Links

### Confirmed dead (no handler)

| File | Line | Element | Issue |
|---|---|---|---|
| `src/pages/Ask.tsx` | ~138 | "Select source" button with `<Filter>` icon | `cursor: pointer` set but no `onClick` handler |
| `src/pages/Ask.tsx` | ~159 | Mic `<button>` | `cursor: pointer` set but no `onClick` handler |

### Confirmed working (do not fix)

The following were investigated and are fully wired:

- "Read full assessment" links → `to="/alerts"` via `DashedLink`
- Signal cards in War Room → `to={/competitors/${id}}`
- "View key catalyst events", "View timeline" → navigation handlers confirmed
- Intelligence Feed tabs (Events, Reports, Market) → tab state handlers confirmed
- Competitor detail tabs (Overview, Pipeline, What It Means, etc.) → tab handlers confirmed
- Calendar strip dates → `onDotClick` handlers present
- Alert read/unread toggles → `onClick={toggleRead}` confirmed
- Ask Ariya button → `openAskModal()` via AppContext confirmed

---

## 5. Data Layer

### JSON files in `src/data/`

| File | Size (approx.) | Contents |
|---|---|---|
| `competitors.json` | ~80 KB | Full competitor profiles — pipeline, SWOT, personnel, financials |
| `market-developments.json` | ~13 KB | Market development cards |
| `reports.json` | ~14 KB | Report entries for Intelligence Feed |
| `events.json` | ~8 KB | Events for calendar/list view |
| `alerts.json` | ~12 KB | 11 signal alerts (GlobalData removed) |
| `pricing.json` | ~6 KB | Pricing benchmark data |
| `market-performance.json` | ~4 KB | KPI metrics |
| `themes.json` | small | Theme configuration |
| `user.json` | small | User persona |

All imports go through **`src/data/kalvista.ts`** as a single re-export hub. Direct JSON imports anywhere in `src/` are a violation of this pattern (none found currently).

### No API calls

Zero `fetch()`, `axios`, or `XMLHttpRequest` calls exist anywhere in `src/`. The app is entirely client-side with static data.

### Duplicated "Market weather" content — `src/pages/WarRoom.tsx` lines 31–41

`IMPLICATION_ITEMS` (lines 31–35) and `WHAT_MOVED_ITEMS` (lines 37–41) are defined as **two separate arrays with identical content**. Both render under different section headings ("Implications · last 7 days" and "What moved this week"). This causes the same three bullet points to appear twice in the Market weather panel. The two arrays should either have distinct content, or be merged into one.

---

## 6. Dependencies

### Production dependencies

| Package | Version | Used | Notes |
|---|---|---|---|
| `react` | ^19.2.5 | ✅ Yes | 31 files |
| `react-dom` | ^19.2.5 | ✅ Yes | `createPortal` in modal/tooltip |
| `react-router-dom` | ^7.14.2 | ✅ Yes | 15 files |
| `lottie-react` | ^2.4.1 | ✅ Yes | TopBar.tsx (Ask Ariya button) |
| `lucide-react` | ^1.8.0 | ✅ Yes | 21 files |
| `recharts` | ^3.8.1 | ✅ Yes | 21 files |
| `framer-motion` | ^12.40.0 | ❌ **Zero imports** | Listed in package.json, no usage in src/ — candidate for removal |
| `tailwindcss` | ^4.2.4 | ✅ Yes (build) | Applied via `@tailwindcss/vite` plugin; correct — no direct imports needed |
| `@tailwindcss/vite` | ^4.2.4 | ✅ Yes | Vite plugin |

**Action:** Remove `framer-motion` from `package.json` if no animation work is planned. Saves ~100 KB from node_modules (not in the bundle since it's not imported, but cleans up the dependency tree).

### Bundle sizes (from `dist/assets/`, last build)

Code splitting is active — all 12 page components are lazy-loaded into separate chunks.

| Chunk | Size (KB) | Notes |
|---|---|---|
| `index-DZ0YI8Xm.js` | **620 KB** | Main bundle — React, Recharts, Router, all shared code |
| `CompetitorProfile-C4NQuycT.js` | 47 KB | Heaviest page chunk |
| `chunk-EVOBXE3Y-BLdu2YjX.js` | 41 KB | Shared vendor chunk |
| `Portal-NGTh_mLP.js` | 35 KB | Intelligence Feed |
| `ask-ariya-anim-DukI_0rn.js` | 30 KB | Lottie animation (lazy-loaded) |
| `WarRoom-BOP63pGI.js` | 26 KB | War Room page |
| `AlertsPage-jDVhPVar.js` | 19 KB | Alerts page |
| `index-aOvvsQ6S.css` | 16 KB | All styles |
| Remaining page chunks | 2–15 KB each | All routes properly split |

**Total initial load (hard navigation to `/`):** ~620 KB main bundle + 16 KB CSS. The 620 KB main bundle is large because Recharts is not split. Acceptable for a demo; for production, Recharts could be moved to lazy chunks.

---

## 7. Timestamps

### How they're generated

Timestamps are **computed at render time** from ISO 8601 date strings stored in JSON. There are no hardcoded relative strings like "16h" in any data file.

**Data format (e.g. `src/data/alerts.json`):**
```json
"timestamp": "2026-04-20T08:15:00Z"
```

**Relative rendering — `src/utils/formatDate.ts`:**
```ts
const now = new Date('2026-04-21')   // frozen demo "today"
// Returns: "Just now", "30m ago", "16 hours ago", "Yesterday",
//          "3 days ago", "1 week ago", "2 weeks ago", or "Mar 14, 2026"
```

**Short format — `src/pages/WarRoom.tsx` lines 156–161:**
```ts
const TODAY = new Date('2026-04-21')
function relTimeShort(ts: string): string {
  const diffH = Math.round((TODAY.getTime() - new Date(ts).getTime()) / 3600000)
  if (diffH < 24) return `${diffH}h`   // "16h"
  return `${Math.round(diffH / 24)}d`  // "3d"
}
```

**Note:** Both `formatDate.ts` and `WarRoom.tsx` hardcode `new Date('2026-04-21')` as the reference "today". This frozen date means timestamps always display the same relative value regardless of when the demo is run. This is intentional for demo stability.

---

## Prioritised Fix List

### P0 — Must fix before any client distribution

| # | Fix | File | Why |
|---|---|---|---|
| 1 | **Commit `vercel.json` to git** | `vercel.json` (root) | Direct URL navigation returns 404 on git-triggered deployments |
| 2 | **Remove internal placeholder text from Market Performance** | `src/pages/MarketPerformance.tsx:79–91` | Names internal team member; exposes Azure/Power BI implementation details to the client |

### P1 — Should fix before demo

| # | Fix | File | Why |
|---|---|---|---|
| 3 | **Deduplicate `IMPLICATION_ITEMS` / `WHAT_MOVED_ITEMS`** | `src/pages/WarRoom.tsx:31–41` | Same 3 bullets appear twice in the Market weather panel — visible quality defect |
| 4 | **Give `WHAT_MOVED_ITEMS` distinct content** | `src/pages/WarRoom.tsx:37–41` | "Implications" and "What moved" should have different content to make both sections meaningful |
| 5 | **Wire "Select source" button** or remove it | `src/pages/Ask.tsx:138` | Shows cursor pointer with no action — broken affordance |
| 6 | **Wire mic button** or remove it | `src/pages/Ask.tsx:159` | Same — interactive element with no behaviour |

### P2 — Before enterprise handoff

| # | Fix | File | Why |
|---|---|---|---|
| 7 | **Move drug/TA hardcodes in TopBar subtitle to `userData`** | `src/components/shell/TopBar.tsx:60,66` | Currently duplicates `user.json` values inline |
| 8 | **Move `IMPLICATION_ITEMS` and Market weather heading to data layer** | `src/pages/WarRoom.tsx:33,815` | Ekterly/Sebetralstat references should come from data, not JSX constants |
| 9 | **Remove `framer-motion` dependency** | `package.json` | Unused; clutters dependency tree |
| 10 | **Move frozen `TODAY` date to shared config** | `src/utils/formatDate.ts:11`, `src/pages/WarRoom.tsx:29` | Currently defined in two separate places; should be one constant |
