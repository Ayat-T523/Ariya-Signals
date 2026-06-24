# Ariya Signals — System State Document

**Date:** 2026-06-24
**Branch:** `iteration-5`
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
| State | `AppContext` (single provider; per-user state in Supabase, localStorage as cache) | ✅ Working |
| Data fetching | React Query (`@tanstack/react-query`) | ✅ Working |
| Database | Supabase (PostgreSQL, REST + WebSocket via `@supabase/supabase-js`) | ✅ Connected |
| Auth | Supabase Auth (email/password + Google/Microsoft SSO); `BYPASS_AUTH` for local dev | ✅ Working |
| Deployment | Vercel (production alias + preview URLs) | ✅ Live |
| Security | Content Security Policy enforced via `vercel.json` headers | ✅ Active |
| Analytics | PostHog | ⚠️ Configured but returning 401/404 errors — analytics only, no user impact |

---

## 2. Application Routes

| Route | Page | Status |
|---|---|---|
| `/sign-in` | Sign In | ✅ Live — email/password + Google/Microsoft SSO |
| `/` | War Room | ✅ Live — primary dashboard |
| `/competitors` | Competitor Grid | ✅ Live + static hybrid |
| `/competitors/:id` | Competitor Profile | ✅ Live + static hybrid |
| `/intelligence` | Intelligence Feed / Portal | ✅ Live + static hybrid |
| `/alerts` | Alerts Feed | ✅ Live — `company_signals` via `getRecentSignals()` |
| `/pricing` | Pricing & Access | ⚠️ Static JSON only |
| `/market-performance` | Market Performance | ✅ Route + page exist |
| `/myspace` | My Space | ✅ Route + page exist |
| `/myspace/alerts` | My Alerts | ✅ Route + page exist |
| `/myspace/documents` | My Documents | ✅ Route + page exist |
| `/ask` | Ask Ariya | ✅ Route + page exist (AI backend not wired) |
| `/admin` | Admin | ✅ Route + page exist |

All routes are lazy-loaded and protected by `AuthGuard` (Supabase Auth or `BYPASS_AUTH` for local dev).

---

## 3. Supabase Tables

### Shared / ingest tables (anon-readable)

| Table | Purpose | Read by |
|---|---|---|
| `company_signals` | All ingest signals — SEC, FDA, PubMed, CT.gov, HTA, messaging drift | WarRoom, AlertsPage, Competitor profiles |
| `assets` | HAE/PNH/PBC asset registry (INN, synonyms, competitor ownership, indication tags) | `useCompetitorSupabase`, onboarding |
| `trials` | ClinicalTrials.gov trial data | Competitor pipeline Gantt, trial design summaries |
| `financial_snapshots` | SEC EDGAR revenue + R&D spend (last 3 FY) | Competitor financial tile |
| `regulatory_calendar` | EMA CHMP/PRAC/OTHER committee meetings | WarRoom Upcoming Events, Portal Events |
| `regulatory_events` | Regulatory milestones (FDA/EMA decisions) | Competitor Key Events |
| `documents` | 10-K, 20-F, FDA labels, NICE TAs, EMA EPARs | Competitor Messaging tab |
| `company_summaries` | Rolling 90-day AI narrative summaries | Competitor profile card (falls back to template) |
| `market_intelligence` | Editorial strategic implications (paywalled) | Portal Market Developments |
| `messaging_snapshots` | Latest scraped core message + pillars per competitor | Competitor Messaging tab (Phase 5) |

### Ingest-only tables (service-role, no anon read)

| Table | Purpose | Written by |
|---|---|---|
| `trial_snapshots` | Content-hash baseline for CT.gov diff engine | `api/ingest/trials.ts` |
| `ingest_runs` | Ingest run audit log | All ingest scripts |

### Per-user tables (RLS default-deny, no anon read)

| Table | Purpose | Key |
|---|---|---|
| `user_profiles` | Onboarding state, indication, asset selection | `user_id = auth.uid()` |
| `watched_assets` | Competitor watchlist | `user_id = auth.uid()` |
| `read_alerts` | Alert read/unread state | `user_id = auth.uid()` |

---

## 4. Static JSON Data Files

Static data lives in `src/data/` re-exported from `src/data/kalvista.ts` (via `dataset-hae.ts`). All files are illustrative/demo data. Files marked ⚠️ are on disk but no longer imported by any component.

| File | Contents | Used By |
|---|---|---|
| `competitors.json` | Competitor metadata, products, pipeline, messaging stubs | Competitor Grid; Onboarding Step 2; CompetitorProfile fallback |
| `events.json` | Conference and congress calendar entries | WarRoom Upcoming Events (merged with live EMA calendar) |
| `market-developments.json` | Market signals (HTA, payer, guideline, advocacy) | Portal Market Developments tab |
| `reports.json` | Earnings/investor report stubs | Portal Earnings tab (disabled) |
| `pricing.json` | Price comparison table across markets | Pricing & Access page |
| `alerts.json` | ~50 curated alert stubs | ⚠️ No longer imported — AlertsPage now reads live `company_signals` |
| `themes.json` | Alert theme clusters | ⚠️ No longer imported — AlertsPage grouped view uses flat live feed |

---

## 5. Page and Module Status

### 5a. War Room (`/`)

| Section | Data Source | Status |
|---|---|---|
| Greeting + timestamp | Static (`userData`) | ✅ Working |
| KPI — New This Week | `company_signals` (last 7 days) | ✅ Live |
| KPI — Unread Signals | `readAlerts` Set (Supabase `read_alerts`) applied to live signals | ✅ Live |
| KPI — High Importance | `company_signals` → severity scoring | ✅ Live |
| Top Signals to Triage | `company_signals` (90-day window, watched competitors) | ✅ Live |
| Signal readability gate | `isSignalReadable()` / `cleanSignalText()` | ✅ Working |
| Signal severity scoring | `computeSeverity()` with lexicon-based `isRelevant()` gate | ✅ Working |
| Signal WHY text | `why_it_matters` DB column → template fallback | ⚠️ Partial — column sparsely populated |
| Market Weather | Derived from live severity counts | ✅ Live |
| Tracked Competitors cards | `company_signals` signal counts + `company_summaries` narrations | ✅ Live |
| Upcoming Events | `regulatory_calendar` (Supabase) merged with `eventsData` (static) | ✅ Hybrid |
| Weekly Digest | Top 3 relevant live signals | ✅ Live |
| Market Implications | `market_intelligence` (Supabase) | ✅ Live (behind `<PaidGate>`) |

### 5b. Competitors (`/competitors`, `/competitors/:id`)

| Section | Data Source | Status |
|---|---|---|
| Competitor grid | `competitors.json` filtered by `watchedCompetitors` | ✅ Working |
| Signal stats on cards | `getAllSignalsSummary()` Supabase | ✅ Live |
| HAE asset count on cards | `assets` table (indication_tags) | ✅ Live |
| Pipeline / Gantt | `trials` (Supabase) via `useCompetitorSupabase` | ✅ Live |
| Financial snapshot | `financial_snapshots` (Supabase, SEC EDGAR) | ✅ Live |
| Key Events | `regulatory_events` + `regulatory_calendar` + static stub | ✅ Hybrid |
| Strategic Signals | `company_signals` (deal, exec_change, press_release types) | ✅ Live |
| Source Documents | `documents` (Supabase) | ✅ Live |
| Messaging tab | `messaging_snapshots` + `company_signals` (messaging_shift) | ✅ Live when snapshot exists; falls back to `competitors.json` stub |

### 5c. Alerts (`/alerts`)

| Section | Data Source | Status |
|---|---|---|
| Alert feed | `company_signals` via `getRecentSignals(180 days)` + `mapSignals()` | ✅ Live |
| Watchlist filter | Scoped to `watchedCompetitors` in DB query | ✅ Working |
| Filter UI (competitor, type, source) | Client-side on live mapped data | ✅ Working |
| Grouped view | Flat "Live signals" cluster (no AI theme clusters yet) | ✅ Working |
| Sort (importance / recency) | Client-side severity sort using `signalMapping.ts` severity | ✅ Working |
| Read/unread state | `read_alerts` table (Supabase); `readAlerts` Set in AppContext | ✅ Live |
| Mark read / unread / all read | Writes to `read_alerts` table; survives reload + cross-device | ✅ Live |
| "What changed" diff panel | Shown when `labelDiff` is non-null (label/trial signals with body excerpt) | ✅ Working |
| Nav badge unread count | Pushed from AlertsPage via `syncUnreadCount()` | ✅ Working |

### 5d. Intelligence Feed (`/intelligence`)

| Tab | Data Source | Status |
|---|---|---|
| Events | `regulatory_calendar` (Supabase) + `eventsData` (static) | ✅ Hybrid |
| Market Developments | `marketDevelopments` (static JSON) | ⚠️ Static |
| Earnings Filings | `company_signals` (press_release type) | ⚠️ Tab disabled ("Coming soon") |

### 5e. Navigation & Shell

| Element | Status |
|---|---|
| NavPanel (collapsible, 64 px / 208 px) | ✅ Working |
| Sign out button | ✅ Working — direct `LogOut` icon in nav footer |
| Guided Tour | ✅ Working |
| Ask Ariya shortcut (`/` key) | ✅ Working (modal only, no AI) |
| Onboarding Modal | ✅ Working (v5 — see §5f) |

### 5f. Onboarding Modal

| Step | What it does | Source of truth |
|---|---|---|
| Step 1: Asset selection | Pick by indication (HAE / PNH / PBC); sets `userAssetId`, `userAssetName`, `userIndication` | Supabase `user_profiles` (localStorage cache) |
| Step 2: Competitor watchlist | Multi-select with product sub-lines; sets `watchedCompetitors` | Supabase `watched_assets` |
| Version stamp | `ONBOARDING_VERSION = 'v5'` — forces re-show if version mismatch | Supabase `user_profiles.onboarding_version` |

---

## 6. Signal Processing Pipeline

### Alerts feed (`/alerts`)
```
company_signals (Supabase)
    ↓ getRecentSignals(180 days, watchedCompetitorIds)
    ↓ mapSignals() — signalMapping.ts
           SIGNAL_TYPE_MAP:     DB signal_type → hyphenated UI key
           SIGNAL_SEVERITY_MAP: severity derived from signal_type
           SIGNAL_SOURCE_MAP:   human source label
           labelDiff:           populated for label_update / trial_update signals
    ↓ client-side: sort + filter (competitor / type / source / unread)
    = Alert cards with read/unread state from Supabase read_alerts
```

### War Room top signals
```
company_signals (Supabase, 90-day window)
    ↓ filter: isSignalReadable() — strips SEC boilerplate, XBRL, short/noisy text
    ↓ filter: watchedCompetitors
    ↓ map: computeSeverity() + buildReadableHeadline() + buildWhyItMatters()
    ↓ sort: HIGH → MEDIUM → LOW, then recency
    ↓ slice(0, 5)
    = Top Signals panel
```

### Diff ingest pipelines (first-run-silence: no signal on baseline seed)
| Pipeline | Table | Signal type |
|---|---|---|
| `api/ingest/trials.ts` | `trial_snapshots` | `trial_update` |
| `supabase/functions/ingest-fda-labels` | `label_snapshots` | `label_update` |
| `scripts/ingest-messaging-firecrawl.mjs` | `messaging_snapshots` | `messaging_shift` |

---

## 7. Configuration: AppContext State

| Slice | Source of truth | localStorage role |
|---|---|---|
| `watchedCompetitors` | Supabase `watched_assets` (hydrated on sign-in) | Cache + BYPASS_AUTH fallback |
| `readAlerts` | Supabase `read_alerts` (hydrated on sign-in) | Not used (Supabase is authoritative) |
| `onboardingComplete` | Supabase `user_profiles.onboarding_complete` | Cache + BYPASS_AUTH fallback |
| `userAssetId/Name` | Supabase `user_profiles` | Cache + BYPASS_AUTH fallback |
| `userIndication` | Supabase `user_profiles` | Cache + BYPASS_AUTH fallback |
| `unreadCount` | Pushed by AlertsPage via `syncUnreadCount()` | Not persisted |

---

## 8. Asset Configuration (`src/config/assets-config.ts`)

Seven assets configured as static config (not stored in Supabase):

**Trackable assets (user selects one in onboarding):**

| Brand | INN | Indication |
|---|---|---|
| Ekterly | sebetralstat | HAE |
| Zevaro | iptacopan | PNH |
| Chelira | seladelpar | PBC |

**Competitor products (signal relevance lexicon):**

| Brand | INN | Indication | Company |
|---|---|---|---|
| Takhzyro | lanadelumab | HAE | Takeda |
| Orladeyo | berotralstat | HAE | BioCryst |
| Deucrictibant | deucrictibant | HAE | Pharvaris |
| Navenibart | navenibart | HAE | Astria Therapeutics |

---

## 9. Security Configuration

`vercel.json` enforces a strict Content Security Policy. Any new external service **must** be added here — CSP failures only appear in browser DevTools.

| Directive | Permitted Domains |
|---|---|
| `connect-src` | `self`, `*.supabase.co`, `wss://*.supabase.co`, `*.fontshare.com`, `*.posthog.com` |
| `font-src` | `self`, `*.fontshare.com` |
| `style-src` | `self`, `unsafe-inline`, `*.fontshare.com` |
| `script-src` | `self`, `*.posthog.com` |
| `img-src` | `self`, `data:`, `blob:` |
| `worker-src` | `self`, `blob:` |
| `frame-ancestors` | `none` |
| `object-src` | `none` |
| `base-uri` | `self` |

---

## 10. Environment Variables

### Production (Vercel)

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (baked into JS bundle at build time) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon JWT (baked into JS bundle at build time) |
| `VITE_POSTHOG_KEY` | PostHog analytics key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for Vercel serverless ingest routes |
| `INGEST_SECRET` | Shared secret header for `/api/ingest/*` endpoints |

### Local dev only (`.env.local`, never committed)

| Variable | Purpose |
|---|---|
| `VITE_BYPASS_AUTH` | Set to `true` to skip Supabase Auth in local dev |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI personal access token |
| `FIRECRAWL_API_KEY` | Firecrawl web scraping API key |
| `SLACK_FEEDBACK_WEBHOOK_URL` | Slack webhook for feedback widget |

---

## 11. Known Gaps and Limitations

| # | Area | Description | Impact |
|---|---|---|---|
| 1 | Signal WHY text | `why_it_matters` sparsely populated; most signals show template fallback text | Reduces signal card quality |
| 2 | `company_summaries` | Population status unverified; competitor card narrations fall back to template | Competitor card summaries are generic |
| 3 | Severity scoring | `isRelevant()` hard-caps signals not containing INN/TA terms to LOW, even M&A or exec changes | Many signals score LOW |
| 4 | Market Weather | 7-day sub-filter on a small pool; frequently shows "No notable moves this week" | Section often empty |
| 5 | Messaging tab | Live only after `ingest-messaging-firecrawl.mjs` has run and `messaging_snapshots` is populated | Falls back to `competitors.json` stub until first ingest |
| 6 | Alerts grouped view | Theme clustering not yet wired — all live signals land in one "Live signals" cluster | No thematic grouping in grouped mode |
| 7 | Pricing & Access | Entirely static stub JSON — no live pricing data | Illustrative only |
| 8 | Intelligence Feed — Market Developments | Static JSON only | Market signal content is illustrative |
| 9 | ESLint | No `eslint.config.js` exists — `npm run lint` fails with "config not found" | Lint is non-functional; pre-existing |
| 10 | PostHog analytics | 401/404 errors in console on every page load | Console noise; analytics not recording |
| 11 | CSL Behring | No live ingest pipeline beyond Firecrawl newsroom scraper | CSL coverage is incomplete |
| 12 | `assets-config.ts` | Asset lexicon lives in static config, not Supabase | Cannot update without a code deploy |

---

*Updated: 2026-06-24 | Branch: iteration-5*
