# Ariya Signals — System State Document

**Date:** 2026-06-23  
**Branch:** `iteration-4`  
**Production URL:** `https://ariya-signals-one.vercel.app`

---

## 1. Infrastructure

| Layer | Technology | Status |
|---|---|---|
| Frontend | React 19 + TypeScript (strict), Vite 8 (OXC bundler) | ✅ Deployed |
| Styling | Tailwind v4 (`@theme` in `index.css`), Satoshi font via Fontshare CDN | ✅ Working |
| Charts | Recharts | ✅ Working |
| Icons | Lucide React | ✅ Working |
| Animations | Framer Motion | ✅ Working |
| Routing | React Router v7 | ✅ Working |
| State | `AppContext` (single provider, localStorage persistence) | ✅ Working |
| Data fetching | React Query (`@tanstack/react-query`) | ✅ Working |
| Database | Supabase (PostgreSQL, REST + WebSocket via `@supabase/supabase-js`) | ✅ Connected |
| Deployment | Vercel (production alias + preview URLs) | ✅ Live |
| Security | Content Security Policy enforced via `vercel.json` headers | ✅ Active |
| Analytics | PostHog | ⚠️ Configured but returning 401/404 errors — analytics only, no user impact |
| Auth | Clerk | ⚠️ Referenced in CSP; auth shell exists but UI is not wired to Clerk flows |

---

## 2. Application Routes

| Route | Page | Notes |
|---|---|---|
| `/` | War Room | Main dashboard — live data |
| `/sign-in/*` | Sign In | Auth (public route) |
| `/competitors` | Competitor Grid | Live + static hybrid |
| `/competitors/:id` | Competitor Profile | Live + static hybrid |
| `/intelligence` | Intelligence Feed / Portal | Live + static hybrid |
| `/alerts` | Alerts Feed | Static JSON only |
| `/pricing` | Pricing & Access | Static JSON only |
| `/market-performance` | Market Performance | Route exists — page implementation TBD |
| `/myspace` | My Space | Route exists — page implementation TBD |
| `/myspace/alerts` | My Alerts | Route exists — page implementation TBD |
| `/myspace/documents` | My Documents | Route exists — page implementation TBD |
| `/ask` | Ask Ariya | Route exists — AI backend not wired |
| `/admin` | Admin | Route exists — page implementation TBD |

All routes are lazy-loaded and protected by `AuthGuard` (supports Clerk, demo password, or bypass mode).

---

## 3. Supabase Tables

### Confirmed Populated

| Table | Purpose | Used By |
|---|---|---|
| `company_signals` | SEC 8-K filings, press releases, exec changes, deal announcements | WarRoom Top Signals, Competitor profiles, Portal Earnings tab |
| `assets` | HAE/PNH/PBC asset registry (INN, synonyms, competitor ownership, indication tags) | `useCompetitorSupabase` bail guard; HAE asset count on Competitor cards |
| `trials` | ClinicalTrials.gov trial data (phase, dates, status) | Competitor pipeline Gantt + trial design summaries |
| `financial_snapshots` | SEC EDGAR revenue + R&D spend (last 3 fiscal years) | Competitor financial snapshot tile |
| `regulatory_calendar` | EMA CHMP/PRAC/OTHER committee meetings | WarRoom Upcoming Events, Portal Events tab |
| `regulatory_events` | Regulatory milestones (FDA/EMA decisions, approval dates) | Competitor Key Events section |
| `documents` | 10-K, 20-F, FDA labels, NICE TAs, EMA EPARs | Competitor Source Documents tab; Messaging tab |

### Existence Confirmed, Population Status Unverified

| Table | Purpose | Status |
|---|---|---|
| `company_summaries` | Rolling 90-day narrative summaries per competitor | Exists; may be empty or stale — frontend falls back to template text |
| `market_intelligence` | Editorial strategic implications (paywalled) | Exists; Portal Market Developments tab falls back to static JSON if empty |

---

## 4. Static JSON Data Files

All static data lives in `src/data/` and is re-exported from `src/data/kalvista.ts` (via `src/data/dataset-hae.ts`). All files are illustrative/demo data.

| File | Contents | Used By |
|---|---|---|
| `competitors.json` | Competitor metadata, marketed products, pipeline | Competitor Grid; Onboarding Step 3 |
| `alerts.json` | ~50 curated alert stubs (typed, severity-scored, themed) | Alerts page (entire data source) |
| `events.json` | Conference and congress calendar entries | WarRoom Upcoming Events (merged with live EMA calendar) |
| `market-developments.json` | Market signals (HTA, payer, guideline, advocacy) | Portal Market Developments tab |
| `reports.json` | Earnings/investor report stubs | Portal Earnings tab (disabled — "Coming soon") |
| `pricing.json` | Price comparison table across markets | Pricing & Access page |
| `themes.json` | Alert theme clusters (icon, name, member alert IDs) | Alerts grouped view |

---

## 5. Page and Module Status

### 5a. War Room (`/`)

The primary dashboard. Combines live Supabase data with static JSON fallbacks.

| Section | Data Source | Status | Notes |
|---|---|---|---|
| Greeting + timestamp | Static (`userData`) | ✅ Working | |
| KPI — New This Week | `company_signals` (Supabase, last 7 days) | ✅ Live | |
| KPI — Unread Signals | `readAlerts` Set (localStorage) applied to live signals | ✅ Live | Count reflects unread live signals |
| KPI — High Importance | `company_signals` → severity scoring | ✅ Live | |
| Top Signals to Triage | `company_signals` (Supabase, 90-day window, watched competitors) | ✅ Live | Shows up to 5 signals after readability + relevance filtering |
| Signal readability gate | `isSignalReadable()` / `cleanSignalText()` in `signalText.ts` | ✅ Working | Strips SEC boilerplate, XBRL, accession numbers; requires 5+ prose words |
| Signal severity scoring | `computeSeverity()` with lexicon-based `isRelevant()` gate | ✅ Working | Signals not containing INN/TA terms are capped at LOW |
| Signal WHY text | `why_it_matters` DB column → template fallback | ⚠️ Partial | DB column sparsely populated; most signals show generic template text |
| Market Weather — pressure | Derived from live severity counts (90-day window) | ✅ Live | |
| Market Weather — this week | `company_signals` (last 7 days) | ✅ Live | May show "No notable moves" if no signals in last 7 days |
| Tracked Competitors cards | `company_signals` signal counts + `company_summaries` narrations | ✅ Live | Narration falls back to template text if `company_summaries` is null/unreadable |
| Upcoming Events | `regulatory_calendar` (Supabase) merged with `eventsData` (static) | ✅ Hybrid | Deduped by title; EMA events always shown; congress events gated by watchlist |
| Weekly Digest | Top 3 relevant live signals | ✅ Live | |
| Market Implications | `market_intelligence` (Supabase) | ✅ Live | Behind `<PaidGate>` UI component (UI-only gate, no backend enforcement) |
| Ask Ariya button | Modal | ✅ UI only | Modal opens with pre-populated prompts; no AI backend wired |

### 5b. Competitors (`/competitors`, `/competitors/:id`)

| Section | Data Source | Status | Notes |
|---|---|---|---|
| Competitor grid | `competitors.json` filtered by `watchedCompetitors` | ✅ Working | Shows only watched competitors |
| Signal stats on cards | `getAllSignalsSummary()` Supabase | ✅ Live | Signal count + latest date per competitor |
| HAE asset count on cards | `assets` table (indication_tags) | ✅ Live | |
| Timeline Gantt | Hardcoded `TIMELINE_ROWS` + live trial enrichment overlay | ✅ Hybrid | Static phase ranges; live ClinicalTrials.gov data overlaid via hook |
| Competitor pipeline | `trials` (Supabase) via `useCompetitorSupabase` | ✅ Live | |
| Financial snapshot | `financial_snapshots` (Supabase, SEC EDGAR) | ✅ Live | |
| Key Events | `regulatory_events` + `regulatory_calendar` (Supabase) + static stub | ✅ Hybrid | |
| Strategic Signals (deals) | `company_signals` signal_type=`deal` | ✅ Live | |
| Personnel Changes | `company_signals` signal_type=`exec_change` | ✅ Live | |
| Press Releases | `company_signals` signal_type=`press_release` | ✅ Live | |
| Source Documents | `documents` (Supabase) | ✅ Live | |
| Messaging / Positioning tab | `competitor.messaging` (static JSON field) + `documents` + `company_signals` (press releases) | ⚠️ Partial | Messaging analysis stub shows "data not yet available" alert; press releases and source documents sections are live |
| Company description | Built from live pipeline + asset data | ✅ Live | |
| "Add competitor" button | UI placeholder | ❌ Not functional | "Available in paid version" — no functionality wired |

### 5c. Alerts (`/alerts`)

| Section | Data Source | Status | Notes |
|---|---|---|---|
| Alert feed | `alerts.json` (static stub) | ❌ Static | Not connected to Supabase `company_signals` |
| Watchlist filter | Not applied | ❌ Gap | All stub alerts show regardless of `watchedCompetitors` |
| Filter UI (competitor, type, source) | Client-side on static data | ✅ UI working | Multi-select dropdowns; unread toggle |
| Grouped view | `themesData` (static clusters) | ✅ Working | Themes with icons, summaries, member alerts |
| Sort (importance / recency) | Client-side on static data | ✅ Working | |
| Read/unread state | `readAlerts` Set (localStorage via AppContext) | ✅ Working | Persisted across sessions |

### 5d. Intelligence Feed (`/intelligence`)

| Tab | Data Source | Status | Notes |
|---|---|---|---|
| Events | `regulatory_calendar` (Supabase) + `eventsData` (static) | ✅ Hybrid | Calendar strip, live EMA events merged with stub congresses |
| Earnings Filings | `company_signals` (Supabase, press_release type) | ✅ Live | Tab marked "Coming soon" / disabled in current UI |
| Market Developments | `marketDevelopments` (static JSON) | ⚠️ Static | Guidelines, epidemiology, payer, HTA, advocacy, deal signals |

### 5e. Pricing & Access (`/pricing`)

| Section | Data Source | Status | Notes |
|---|---|---|---|
| Price comparison table | `pricing.json` (static stub) | ⚠️ Static | Filtered by watchlist (competitor column only) |

### 5f. Navigation & Shell

| Element | Status |
|---|---|
| NavPanel (collapsible, 64 px / 208 px) | ✅ Working |
| TopBar | ✅ Working |
| Guided Tour (TOUR_ROUTES) | ✅ Working |
| Ask Ariya shortcut (`/` key) | ✅ Working (modal only, no AI) |
| Mobile nav overlay | ✅ Working |
| Onboarding Modal | ✅ Working (see §5g) |

### 5g. Onboarding Modal

| Step | What it does | Data Source | Status |
|---|---|---|---|
| Step 1: Role | Select from 5 roles; persisted to localStorage as `ariya-user-role` | Static config | ✅ Working |
| Step 2: Asset selection | Pick asset by indication (HAE / PNH / PBC); sets `userAssetId`, `userAssetName`, `userIndication` | `ASSETS_CONFIG` (static) | ✅ Working |
| Step 3: Competitor watchlist | Multi-select chips with product sub-lines and +N overflow; sets `watchedCompetitors` | `competitors.json` + `ASSETS_CONFIG` | ✅ Working |
| Version stamp | `ONBOARDING_VERSION = 'v4'` forces re-show for visitors from prior versions | AppContext | ✅ Working |

---

## 6. Signal Processing Pipeline

All live signals in the War Room pass through this sequential pipeline:

```
company_signals table (Supabase)
    ↓ getRecentSignals(90 days, watchedCompetitorIds)
    ↓ filter: isSignalReadable(s)
           cleanSignalText() → decodeEntities → stripBoilerplate
                             → stripExhibitPreamble → isReadableProse
           Rejects: SEC preambles, XBRL, accession numbers, .htm filenames,
                    all-caps blobs, <60% alpha ratio, <5 prose words
    ↓ filter: watchedCompetitors.has(s.competitor_id)
    ↓ map: mapDbSignalToDisplay
           buildReadableHeadline() — humanises SEC 8-K item headings for exec_change signals
           computeSeverity()       — HIGH/MED/LOW based on keyword scoring + isRelevant() gate
           buildWhyItMatters()     — DB why_it_matters column → template fallback
    ↓ sort by severity (HIGH first) then date (newest first)
    ↓ slice(0, 5)
    = Top Signals panel (up to 5 signals shown)
```

### Current Signal Quality (default watchlist: takeda, biocryst, pharvaris)

- **~12 signals** pass the readability gate in the 90-day window
- Severity breakdown: ~2 HIGH (Pharvaris Phase 3 financial data), ~4 MEDIUM (exec changes), ~6 LOW
- `why_it_matters` column is sparsely populated — most signals show template fallback WHY text
- Signals not containing INN or TA terms (e.g., clean corporate prose) are capped at LOW severity by `isRelevant()`

---

## 7. Configuration: AppContext State

Global application state persisted to localStorage:

| Key | localStorage key | Contents |
|---|---|---|
| `watchedCompetitors` | `pharma-inc-ciwarroom-watched` | `Set<string>` of competitor IDs |
| `readAlerts` | `pharma-inc-ciwarroom-read-alerts` | `Set<string>` of read signal IDs |
| `onboardingComplete` | `onboardingComplete` | Boolean |
| `trackedAssets` | `trackedAssets` | `{ assetId, assetName, indication, lexiconInns, lexiconTaTerms }` |
| `userRole` | `ariya-user-role` | One of: commercial, access, analytics, bd, executive |

The lexicon (`lexiconInns` + `lexiconTaTerms`) from `trackedAssets` drives all signal relevance gating and severity scoring at runtime.

---

## 8. Asset Configuration (`src/config/assets-config.ts`)

Seven assets configured as static config (not yet stored in Supabase):

**Trackable assets (user selects one in onboarding):**

| Brand | INN | Indication |
|---|---|---|
| Ekterly | sebetralstat | HAE |
| Zevaro | iptacopan | PNH |
| Chelira | seladelpar | PBC |

**Competitor products (used for signal relevance lexicon):**

| Brand | INN | Indication | Company |
|---|---|---|---|
| Takhzyro | lanadelumab | HAE | Takeda |
| Orladeyo | berotralstat | HAE | BioCryst |
| Deucrictibant | deucrictibant | HAE | Pharvaris |
| Navenibart | navenibart | HAE | Astria Therapeutics |

Each asset entry contains `lexiconInns` (~15 drug name synonyms) and `lexiconTaTerms` (~10–15 TA keywords) used at runtime to gate signal relevance.

---

## 9. Security Configuration

`vercel.json` enforces a strict Content Security Policy on all responses. Any new external service added to the app **must** be added to the matching directive here — CSP failures only appear in browser DevTools, never in `curl` or local dev.

| Directive | Permitted Domains |
|---|---|
| `connect-src` | `self`, `*.supabase.co`, `wss://*.supabase.co`, `*.fontshare.com`, `*.posthog.com`, `*.clerk.com`, `*.clerk.accounts.dev` |
| `font-src` | `self`, `*.fontshare.com` |
| `style-src` | `self`, `unsafe-inline`, `*.fontshare.com` |
| `script-src` | `self`, `*.posthog.com`, `*.clerk.com`, `*.clerk.accounts.dev` |
| `img-src` | `self`, `data:`, `blob:` |
| `worker-src` | `self`, `blob:` |
| `frame-ancestors` | `none` |
| `object-src` | `none` |
| `base-uri` | `self` |

---

## 10. Environment Variables (Production)

| Variable | Purpose | Status |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (baked into JS bundle at build time) | ✅ Set in Vercel Production |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon JWT (baked into JS bundle at build time) | ✅ Set in Vercel Production |
| `VITE_POSTHOG_KEY` | PostHog analytics key | ✅ Set — returning errors (analytics only) |
| `VITE_DEMO_PASSWORD_HASH` | Hash for demo access gate | ✅ Set |

---

## 11. Known Gaps and Limitations

| # | Area | Description | Impact |
|---|---|---|---|
| 1 | Alerts page | Entire page is static JSON — not connected to `company_signals` | All alert content is illustrative only |
| 2 | Alerts page | No watchlist filtering — all stub alerts appear regardless of `watchedCompetitors` | Configuration has no effect on Alerts |
| 3 | Signal WHY text | `why_it_matters` column sparsely populated in `company_signals`; most signals show template text | Reduces signal card quality |
| 4 | `company_summaries` | Population status unverified; competitor card narrations fall back to template needle text | Competitor card summaries are generic |
| 5 | Severity scoring | `isRelevant()` hard-caps all signals not containing INN/TA terms to LOW, even for strategic events like M&A or exec changes | Most signals score LOW regardless of actual importance |
| 6 | Market Weather | Depends on 7-day sub-filter of an already-small signal pool; frequently shows "No notable moves this week" | Market Weather section often empty |
| 7 | `market_intelligence` | Population status unverified; Market Implications section may show empty state | Portal strategic view incomplete |
| 8 | Messaging tab | Messaging analysis data not yet available — shows informational alert stub | Competitor positioning analysis absent |
| 9 | Pricing & Access | Entirely static stub JSON — no live pricing data | Illustrative only |
| 10 | Intelligence Feed — Earnings tab | Disabled ("Coming soon") | Earnings intelligence not accessible |
| 11 | Intelligence Feed — Market Developments | Static JSON only | Market signal content is illustrative |
| 12 | Routes with no implementation | `/market-performance`, `/myspace`, `/myspace/alerts`, `/myspace/documents`, `/ask`, `/admin` | Navigation dead-ends |
| 13 | PostHog analytics | 401/404 errors in console on every page load | Console noise; analytics not recording |
| 14 | CSL Behring | No live ASX ingest pipeline; only manually seeded rows | CSL coverage is incomplete |
| 15 | `assets-config.ts` | Asset lexicon lives in static config, not Supabase | Cannot be updated without a code deploy |
| 16 | Git commits pending | 3 session fixes deployed to production but not yet committed to `iteration-4` branch | Git history does not reflect deployed state |

---

## 12. Changes Applied in This Session (2026-06-23)

These three changes are deployed to production but not yet committed to git.

| File | Change |
|---|---|
| `vercel.json` | Added `https://*.supabase.co wss://*.supabase.co` to `connect-src` — this was the root cause of the production site showing 0 signals (browser was blocking all Supabase requests); also widened fontshare directives from `api.fontshare.com` to `*.fontshare.com` to cover `cdn.fontshare.com` where `.woff2` files are served |
| `src/lib/signalText.ts` | Extended `decodeEntities()` to handle hex HTML entities (`&#x2022;` → `•`, `&#x2013;` → `–`); previously only decimal entities were decoded |
| `index.html` | Removed `crossorigin` attribute from `<link rel="preload" as="style">` (CSS endpoints do not support CORS preload); added separate `<link rel="preconnect" href="https://cdn.fontshare.com" crossorigin>` for font file origin |

---

*Generated: 2026-06-23 | Branch: iteration-4 | Author: Ayat Tayebulla / Ariya (Claude)*
