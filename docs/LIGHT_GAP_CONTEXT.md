# Ariya Light — Gap & Current-State Context Pack

**Purpose.** A self-contained briefing for ideating solutions to the four priority gaps between the current Ariya Signals build (iteration-5) and the *Ariya Light* free-tier spec. Written to be pasted into Claude cowork without the repo attached. Every claim below is grounded in a file/line reference verified on 2026-06-24.

**Priority order (set by the user):**
1. ChEMBL autocomplete
2. Auth + onboarding + asset selection
3. Change detection + alert feed
4. Competitor website (messaging baseline & drift)
5. ~~Email digest~~ — **explicitly not required**

> **Important correction to the iteration-4 gap analysis.** That analysis (written at the close of iteration 4) said *"ChEMBL is entirely absent"* and *"Clerk is referenced in the CSP but not wired to any auth flow."* **Both are now out of date.** A working ChEMBL search endpoint and a ChEMBL lexicon-seed script exist, and Clerk is fully wired as one of three selectable auth modes. The real gaps are narrower and more specific — detailed per-priority below.

---

## 0. Stack & repository orientation

- **React 19 + TypeScript (strict)**, **Vite 8 (OXC bundler)**, **Tailwind v4** (`@theme` in `src/index.css`), **React Router v7** (routes in `src/App.tsx`), **Recharts**, **Lucide**, **Framer Motion**.
- **Supabase** (Postgres + Edge Functions, Deno runtime) is the live data backend. **Vercel** hosts the SPA + `/api/*` serverless functions. **Clerk** is the auth provider (optional, flag-gated). **PostHog** analytics.
- **No test runner** is configured. `npm run build` = `tsc && vite build`.
- There is a **graphify** knowledge graph at `graphify-out/` (see root `CLAUDE.md`).

### Two parallel source trees — use the root one
The repo root `C:\Users\Ayat\Documents\Claude\Projects\Ariya-Signals\` is the **live iteration-5 codebase** (`src/`, `scripts/`, `supabase/`, `api/`). There is also an older copy at `ariya-signals-main/` — **ignore it**; it is stale.

### The single most important architectural fact
There are **two disconnected data worlds** in the app:

| World | Backing store | Reaches which UI |
|---|---|---|
| **Demo/illustrative** | Static JSON in `src/data/*.json`, re-exported via `src/data/kalvista.ts` | War Room cards, **Alerts page**, themes, market performance, pricing |
| **Live ingested** | Supabase tables (`company_signals`, `trials`, `assets`, `documents`, …) | **Only** the Competitor Profile, via the `useCompetitorSupabase` hook |

This split is the root cause of two of the four gaps (alerts feed, messaging). Live signals are ingested into Supabase by ~25 scripts + 5 Edge Functions, **but the Alerts feed UI never reads them** — it imports `src/data/alerts.json`. Keep this in mind throughout.

### Key file map
```
src/
  App.tsx                       Routes + AuthGuard (3 auth modes)
  main.tsx                      ClerkProvider mount (conditional on env key)
  context/AppContext.tsx        Global state; reads static alerts.json; localStorage persistence
  config/
    assets-config.ts            STATIC curated asset catalog (5 HAE + 1 PNH + 1 PBC)
    demo-config.ts              Single-client identity constants ("Pharma Inc", David persona)
    client.ts                   (alias surface)
  components/
    OnboardingModal.tsx         3-step onboarding (role → asset → competitors)
    competitor/tabs/MessagingTab.tsx   Messaging tab (live press + "not yet available" stub)
  pages/
    SignIn.tsx                  Demo-password form + Clerk form (no sign-up, no SSO)
    AlertsPage.tsx              Reads STATIC alerts.json — not Supabase
  hooks/useCompetitorSupabase.ts   The ONLY bridge from live Supabase data to UI
  lib/db/index.ts               All Supabase getter queries (typed)
  lib/signalText.ts             Headline cleaning / prose gate / buildReadableHeadline
api/
  chembl/search.ts              ✅ WORKING ChEMBL proxy endpoint (Vercel serverless)
  ingest/trials.ts              CT.gov ingest (upsert onConflict nct_id — overwrites, no diff)
scripts/
  chembl-lexicon-seed.mjs       ✅ Seeds asset_lexicon from ChEMBL REST API
  lib/signal-gate.mjs           Shared ingest utils: dedup, lexicon, date parsing, severity
  ingest-*.mjs                  ~20 Firecrawl/API ingest scripts → company_signals
supabase/
  functions/ingest-fda-labels/  ✅ ONLY true snapshot-diff change detector (label_snapshots)
  functions/ingest-pubmed/      PubMed weekly (Wednesday cron)
  functions/ingest-hta/, ingest-ir-rss/, ingest-federal-register/
  company_signals.sql, schema.sql, seeds/*.sql
```

---

## 1. PRIORITY 1 — ChEMBL autocomplete

### Spec requirement (§4.2, §5, §11.2)
At onboarding, "Add tracked assets by INN. Drug-name autocomplete is served by **ChEMBL** … resolves synonyms to a canonical entity." ChEMBL is the "drug identity backbone" that makes Light disease-area-agnostic without code deploys.

### What already exists ✅
**A. A working ChEMBL search proxy** — `api/chembl/search.ts` (Vercel serverless function):
- `GET /api/chembl/search?q=<query>` (min 2 chars), 10s timeout, CORS-enabled.
- Calls `https://www.ebi.ac.uk/chembl/api/data/molecule/search?q=…&limit=10` (no API key needed).
- Returns a typed `ChemblResult[]`:
  ```ts
  interface ChemblResult {
    inn: string            // canonical INN — primary entity key
    chembl_id: string      // stable cross-source ID
    max_phase: number | null
    drug_type: string | null      // "Small molecule" | "Biologicals"
    synonyms: string[]            // incl. research codes
    research_codes: string[]      // syn_type === RESEARCH_CODE
    atc_codes: string[]           // approved drugs only
    usan_stem_label: string | null  // drug CLASS (not mechanism)
  }
  ```
- **Status: built, returns live data, but NO UI consumes it.** No `fetch('/api/chembl/search')` call exists anywhere in `src/`.

**B. A ChEMBL lexicon-seed script** — `scripts/chembl-lexicon-seed.mjs`:
- Run manually (`node --env-file=.env.local scripts/chembl-lexicon-seed.mjs`).
- For a **hardcoded** `TARGETS` list of 7 HAE INNs, searches ChEMBL by pref_name (then synonym fallback), fetches mechanism, and **upserts into the `asset_lexicon` table** (`onConflict: 'inn'`).
- `asset_lexicon` columns used: `inn, brand_name, chembl_id, synonyms, max_phase, first_approval, mechanism, fetched_at`.
- This table is what the ingest pipeline reads for relevance gating (see `scripts/lib/signal-gate.mjs` → `loadLexicon`), and what `AppContext` reads via `getLexiconByInn(inn)` to populate `liveLexiconInns`.

### The actual gap
The onboarding asset picker does **not** use ChEMBL. `OnboardingModal.tsx` step 2 filters the **static** `ASSETS_CONFIG` array (`src/config/assets-config.ts`):
```ts
const filteredAssets = ASSETS_CONFIG.filter(a =>
  assetSearch === '' ||
  a.brandName.toLowerCase().includes(assetSearch.toLowerCase()) ||
  a.innName.toLowerCase().includes(assetSearch.toLowerCase())
)
```
`ASSETS_CONFIG` is **7 hardcoded entries** (Ekterly/sebetralstat, Zevaro/iptacopan, Chelira/seladelpar, + Takhzyro, Orladeyo, Deucrictibant, Navenibart). Each carries a hand-maintained `lexiconInns` and `lexiconTaTerms` array. **To add a new asset today you edit this file and redeploy** — exactly the constraint Light is meant to remove.

So the ChEMBL gap is **wiring + persistence, not data access**:
1. Onboarding search box → live `/api/chembl/search` autocomplete (debounced) instead of filtering `ASSETS_CONFIG`.
2. On selection, persist the chosen ChEMBL entity (INN + synonyms + chembl_id + mechanism) so it survives as the user's tracked asset. Today the tracked asset is just an `id` string pointing back into the static config (`userAssetId` in `AppContext`, persisted to `localStorage['ariya-user-asset-id']`).
3. Decide where the canonical asset record lives: `asset_lexicon` (exists, ingest reads it) vs a new `assets`/user-watchlist table. Note `assets-config.ts`'s own header says: *"MIGRATION: This will move to a Supabase `assets` table … this file becomes the static seed / offline fallback."*

### Open design questions for ideation
- **Per-user watchlists?** Light is multi-tenant self-serve. Today there is no per-user asset storage — `userAssetId` is a single value in `localStorage`, and `asset_lexicon` is global (shared across all ingest). Adding a user's arbitrary ChEMBL pick means either (a) writing it to `asset_lexicon` globally, or (b) a new per-user `watched_assets` table. This intersects Priority 2 (auth identity).
- **Competitor inference.** Spec §4.3: "Company-level tracking is inferred automatically from each asset's sponsor; no separate company-selection step." ChEMBL does **not** reliably give the current commercial sponsor. Today competitors come from `ASSETS_CONFIG[].suggestedCompetitors` (hand-curated) and `competitors.json`. Resolving sponsor→competitor for an arbitrary ChEMBL drug is unsolved.
- **Lexicon generation.** The relevance gate (`lexiconInns`/`lexiconTaTerms`) is currently hand-written per asset. For an arbitrary ChEMBL pick, the TA-term list (e.g. "bradykinin", "kallikrein") has no obvious automatic source. ChEMBL gives synonyms + ATC + mechanism, but not a curated TA keyword set.
- **Ingest is INN-list-driven, not user-driven.** Edge Functions read INNs from `asset_lexicon` (e.g. `ingest-pubmed` filters `length >= 8`). A new ChEMBL asset only starts generating signals once it's in `asset_lexicon` AND the relevant ingest jobs run. There is latency between "user adds asset" and "signals appear."

---

## 2. PRIORITY 2 — Auth + onboarding + asset selection

### Spec requirement (§4)
"Gated behind a user account … a real, self-serve user can sign up, log in, and configure their own watch list." **Account = email + password, with optional SSO (Google / Microsoft).** Onboarding: TA → assets by INN (ChEMBL autocomplete) → auto-inferred companies → optional custom-keywords step.

### What exists today — auth is wired, as a *demo gate*
There are **three auth modes**, selected by environment flags in `src/App.tsx`:
```ts
const BYPASS_AUTH        = import.meta.env.VITE_BYPASS_AUTH === 'true'
const CLERK_CONFIGURED   = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.trim()
const DEMO_PASSWORD_MODE = !!import.meta.env.VITE_DEMO_PASSWORD_HASH?.trim()

function AuthGuard() {
  if (BYPASS_AUTH) return <Outlet />              // local dev, no gate
  if (DEMO_PASSWORD_MODE) return <DemoPasswordGuard />   // shared password
  if (!CLERK_CONFIGURED) return <Outlet />        // no creds → pass through
  return <ClerkAuthGuard />                        // per-user Clerk
}
```

- **Mode A — Demo password (current production path).** `SignIn.tsx` → `DemoPasswordSignIn`: one shared password, SHA-256 hashed in-browser, compared to `VITE_DEMO_PASSWORD_HASH`. On success sets `localStorage['ariya-demo-unlocked']='1']`. `DemoPasswordGuard` checks that flag. **This is a single shared secret for all users — no accounts, no identity.**
- **Mode B — Clerk (built but secondary).** `main.tsx` conditionally mounts `<ClerkProvider>` when `VITE_CLERK_PUBLISHABLE_KEY` is set (with custom Satoshi/blue appearance). `ClerkAuthGuard` uses `useAuth()` → redirects to `/sign-in` if not signed in. `ClerkOnboardingSync` re-opens onboarding when a new `userId` appears. **But** `SignIn.tsx` → `ClerkSignIn` only does `signIn.create({ identifier: DEMO_IDENTIFIER, password })` against a **single hardcoded identifier** (`VITE_DEMO_EMAIL` or `DEMO.personaEmail`). **There is no sign-up form, no email field, and no Google/Microsoft SSO buttons.**

### The actual gap
- **No self-serve sign-up.** Neither mode lets a new user create an account. Clerk supports this natively but the UI (`SignIn.tsx`) only renders a password field bound to one preset identifier.
- **No SSO.** Clerk supports Google/Microsoft OAuth out of the box; no `authenticateWithRedirect`/social buttons are rendered.
- **No per-user data.** Onboarding selections persist to `localStorage` only (`onboardingComplete`, `trackedAssets`, `ariya-user-asset-id`, `ariya-user-role`, watched competitors). Nothing is keyed to a Clerk `userId` server-side. Two users on the same browser share state; the same user on two devices shares nothing.
- **Onboarding is role-first and static-asset-based.** `OnboardingModal.tsx` is 3 steps: (1) pick role from 5 hardcoded `ROLES`; (2) pick asset from static `ASSETS_CONFIG`; (3) confirm competitors from `competitors.json`. The spec's onboarding is **asset-first via ChEMBL** and has **no role step** in Light (roles/per-role tailoring are a paid feature, spec §2). There is **no custom-keywords step** (spec §4.4).
- **Role step is arguably out-of-scope for Light.** Spec §2: "Per-role tailoring: None (single view)" for Light. The current 5-role selector is a Full-tier concept.

### Onboarding state model (for reference)
`AppContext.tsx` owns it. localStorage keys: `pharma-inc-ciwarroom-watched`, `pharma-inc-ciwarroom-read-alerts`, `onboardingComplete` (+ `onboardingVersion` stamp, currently `'v4'`), `ariya-user-role`, `ariya-user-asset-id`, `ariya-user-asset`, `ariya-user-indication`, `trackedAssets`. On asset selection, `AppContext` fetches `getLexiconByInn()` → sets `liveLexiconInns` (live synonyms from `asset_lexicon`), falling back to the static `lexiconInns`.

### Open design questions for ideation
- Commit to Clerk for real accounts (sign-up + email/password + Google/Microsoft social connections), or a different provider? Clerk is already mounted and themed — lowest-friction path.
- Where does per-user watchlist state live once accounts are real? (Supabase table keyed on Clerk `userId`, replacing the `localStorage` watchlist.) RLS implications: today most tables are read via the anon key (`grant_anon_read.sql`).
- Drop the role step for Light, or keep it as optional? Affects onboarding flow shape.
- Does removing the shared-password mode break the existing demo deployments? (It's the current production gate.)

---

## 3. PRIORITY 3 — Change detection + alert feed

### Spec requirement (§7 "Alerts feed", §9 "Change-detection")
"Each ingest is diffed against the prior snapshot to generate alerts (new trial, status change, label update, new filing, messaging shift). This is the alerts engine and it is fully deterministic." The Alerts feed is the product **spine**: filter chips by competitor + signal type, read/unread, generic "why it matters" per alert, works fully without AI.

### What exists today
**A. The Alerts UI is built and polished — but reads static JSON.** `src/pages/AlertsPage.tsx`:
```ts
import alertsData from '../data/alerts.json'        // ← static demo file
import competitorsData from '../data/competitors.json'
import themesData from '../data/themes.json'
```
It has everything the spec's feed needs **except a live data source**: list/grouped (themed) views, severity sorting, multi-select filter dropdowns (Competitor / Type / Source), unread chips, mark-read/mark-all-read, a **"What changed" diff panel** for `label-change` alerts (renders `alert.labelDiff.previous` vs `.current` — but from static JSON), and a "Why it matters" strip. Read-state lives in `AppContext` (`readAlerts` Set → localStorage), also seeded from `alerts.json`'s `read` flags.

**B. Real change-detection exists for exactly ONE source.** `supabase/functions/ingest-fda-labels/index.ts` is the reference implementation of the spec's diff engine:
- Maintains a `label_snapshots` table (`application_no`, `sections_hash`, `label_version`, `raw_label_json`).
- Hashes key label sections; compares to stored snapshot. **First run seeds baseline and writes NO signal** (correct diff semantics). On hash change, `detectChangedSection()` identifies which section moved, writes a `signal_type='label_update'` row to `company_signals`, then updates the snapshot.
- This is exactly the "diff vs prior snapshot → emit alert only on change" pattern. **It is not generalized to any other source.**

**C. Every other ingest is append/upsert, not diff.**
- `scripts/lib/signal-gate.mjs` → `isDuplicate(supabase, sourceHash)`: dedup is a **content-hash existence check** (`source_hash` already in `company_signals`?). This prevents re-inserting the *same* item but does **not** detect a *change* to an existing item.
- `api/ingest/trials.ts`: `upsert(batch, { onConflict: 'nct_id', ignoreDuplicates: false })` — **overwrites** the prior trial row. The old `status` is gone after upsert, so a Recruiting→Completed transition leaves **no trace and emits no alert**. The spec explicitly wants "status change" alerts here.
- Other ingest (`ingest-pubmed`, `ingest-hta`, IR/congress Firecrawl scripts) insert new rows with hash-dedup. A genuinely new publication/decision = a new row, which is *close to* change-detection by accretion, but there is no diffing of mutable fields and no unified "alert" object.

**D. Live signals DO reach the DB and the Competitor Profile — but not the Alerts page.** `company_signals` is queried by `src/lib/db/index.ts` (`getSignalsByCompetitorId`, `getRecentSignals(limitDays)`, `getHtaSignalsByCompetitorId`, `getAllSignalsSummary`) and surfaced **only** through `useCompetitorSupabase` on the Competitor Profile (deals, exec changes, press releases, HTA, label updates). `getRecentSignals` already exists and is shaped for a feed but **nothing renders it as the alerts feed.**

### `company_signals` table (the live signal store)
Base schema (`supabase/company_signals.sql`) + columns added by later migrations (observed in code, e.g. edge functions insert these):
```
id uuid PK, competitor_id text, signal_type text, date date,
headline text, body_excerpt text, items text, source_url text,
accession_number text, created_at timestamptz,
source_hash text, data_source text, severity text, why_it_matters text
unique(competitor_id, accession_number)   -- from base schema
```
`signal_type` values in use across ingest: `deal`, `press_release`, `exec_change`, `label_update`, `hta_decision`, `congress_abstract`, `regulatory_catalyst`, `publication`. `data_source` values: `sec_edgar`/`openfda_label`/`eu_hta_firecrawl`/`pubmed`/`congress_firecrawl`/`ir_firecrawl`/`csl_firecrawl`/`takeda_firecrawl`. Note the Alerts UI's `TYPE_CONFIG` uses **different, hyphenated** keys (`trial-update`, `label-change`, `exec-move`, …) — a vocabulary mismatch to reconcile when wiring live data.

### The actual gap
1. **Wire the Alerts page to `company_signals`** (via a `getRecentSignals`-style query) instead of `alerts.json`. Reconcile the type vocabulary (DB `snake_case`/values vs UI hyphenated keys), severity values (DB writes `HIGH/MEDIUM/LOW`; UI expects `high/medium/low/critical`), and read-state keying (currently alert `id`s from JSON; live rows have UUIDs).
2. **Generalize the diff engine** beyond FDA labels: a snapshot+diff step for trial status (needs to stop blind-overwriting in `trials.ts`, or keep a `trial_snapshots`/history), and for messaging (Priority 4). The `label_snapshots` pattern is the template.
3. **Unify "alert" semantics.** Today an "alert" (JSON, rich: `whatHappened`, `whyItMatters`, `labelDiff`, `severity`, `theme`) and a "signal" (`company_signals` row) are different shapes. Decide whether alerts are a view over `company_signals` or a derived table.

### Open design questions for ideation
- Are alerts a **live query** over `company_signals` (simplest), or a **materialized `alerts` table** produced by the diff step (matches spec's "change-detection generates alerts")?
- How to preserve prior state for diffing where ingest currently overwrites (trials)? Append-only history table vs snapshot table vs `updated`/`previous_*` columns.
- Read/unread for live rows: move from localStorage Set to a per-user table (ties to Priority 2)?
- The spec wants a generic "why it matters" line per alert. `company_signals.why_it_matters` exists and some scripts populate it (`scripts/backfill-why.mjs`, `lib/extractWhy.mjs`). Reuse that.
- Theming/clustering (`themes.json` grouped view) has no live equivalent — keep flat for Light, or derive clusters?

---

## 4. PRIORITY 4 — Competitor website (messaging baseline & drift)

### Spec requirement (§7 "Competitor messaging baseline and drift", C7)
"Stored positioning/claims snapshots; alert on language shifts. Reuses the existing scraping framework." Sources: competitor websites + congress abstracts. Refresh weekly.

### What exists today
**A. The Messaging tab UI is built with three sections** — `src/components/competitor/tabs/MessagingTab.tsx`:
1. **`AnnouncementsSection`** — live. Renders `competitor.recentPressReleases` (SEC 8-K item 8.01 press releases, sourced live from `company_signals` via `useCompetitorSupabase`). Real data.
2. **`SourceDocsSection`** — live. Lists ingested primary documents (`documents` table: 10-K, 20-F, FDA-label, NICE-TA, EMA-EPAR) with a *"review pending"* note. Real data, but no extracted messaging.
3. **The messaging *analysis* itself is a hardcoded stub.** If `competitor.messaging` data exists it would render `CurrentMessageCard` / `TimelineCard` (with a `shiftDetected` badge: "⚡ Shift detected" vs "Consistent with prior messaging") / `ComparisonTable`. **But no ingest populates `competitor.messaging`** — so the tab shows the *"Messaging data not yet available"* warning block:
   > "Structured messaging analysis requires systematic review of congress presentations, earnings transcripts, and press releases."

**B. The scraping framework exists and is proven.** `scripts/lib/firecrawl.mjs` + ~10 `ingest-*-firecrawl.mjs` scripts already scrape IR pages, congress programs, EU HTA sites, and company press (CSL, Takeda) via the Firecrawl v2 REST API, with an anti-hallucination check (`titleInMarkdown`). So the **capability** to scrape a competitor website snapshot is present and battle-tested.

### The actual gap
- **No website-snapshot ingest.** Nothing scrapes a competitor *brand/product website*, stores a positioning/claims snapshot, or diffs it over time. The `TimelineCard`'s `shiftDetected` flag has no producer.
- **No `messaging` data source.** The UI is ready (`CurrentMessageCard`, `TimelineCard`, `ComparisonTable`) but `competitor.messaging` is never populated from live data — only the legacy static `market-developments.json`/competitor JSON could fill it.
- **This is fundamentally Priority 3's diff engine applied to scraped web copy:** snapshot competitor site → hash/store → weekly re-scrape → diff → emit a `messaging_shift` signal. The `label_snapshots` pattern (Priority 3.B) is the direct template; a `messaging_snapshots` table would mirror it.

### Open design questions for ideation
- Which competitor URLs to snapshot, and at what granularity (whole page vs extracted claims/pillars)? Spec §11.3 open question: "which competitor and HTA sites are already covered by the existing framework, and which need new adapters?"
- Diff method: raw-text hash (like labels) is brittle for marketing pages (cookie banners, rotating content). Likely needs Firecrawl structured extraction of "core message + pillars" then semantic/field diff — heavier, possibly AI-assisted (but spec says portal must work without AI).
- Where does the snapshot live, and how does a detected shift become an alert row that flows into Priority 3's feed?

---

## 5. Cross-cutting themes (read before designing any single fix)

1. **The static-JSON ↔ live-Supabase split is the spine of three gaps.** Priorities 3 and 4 are both "wire the already-built UI to live data + add a diff step." Priority 1 is "wire the already-built ChEMBL endpoint to the onboarding UI + persist." A unifying decision about *where canonical per-user/per-asset state lives in Supabase* would de-risk all four.
2. **The `label_snapshots` diff engine is the reusable template** for every change-detection need (trials, messaging, HTA). Generalizing it is higher-leverage than four bespoke detectors.
3. **`asset_lexicon` is the hinge between onboarding and ingest.** ChEMBL onboarding writes here; ingest reads here. A user adding an asset must land in this table for signals to flow.
4. **Auth identity gates per-user data.** Until accounts are real (Priority 2), watchlists/read-state can only live in `localStorage`, which undercuts the multi-tenant premise. Priority 2 is a soft prerequisite for doing Priorities 1 and 3 *properly* (per-user), even though it's listed second.
5. **Vocabulary mismatches to reconcile when wiring live data:** signal_type values (DB vs UI hyphenated keys), severity casing (`HIGH` vs `high`, plus UI's unused `critical`), and alert-vs-signal object shapes.

---

## 6. Environment-flag matrix (how the app behaves by config)

**Auth is now Supabase Auth only.** Clerk and demo-password modes were retired in Phase 2 (iteration-5, 2026-06-24). `ClerkProvider`, `VITE_CLERK_PUBLISHABLE_KEY`, and `VITE_DEMO_PASSWORD_HASH` no longer exist in the codebase.

| Env var | Effect |
|---|---|
| `VITE_BYPASS_AUTH=true` | No auth gate — skips `SupabaseAuthGuard` entirely (local dev only) |
| `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | **Required for auth + live data.** `supabase` client is null when absent; `AuthGuard` denies access; all DB getters return `[]` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side ingest writes (scripts + Edge Functions) |
| `INGEST_SECRET` | Header auth for `/api/ingest/*` endpoints |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI personal access token (Edge Function deploys) |
| `FIRECRAWL_API_KEY` | firecrawl.dev API key (scraping ingest scripts) |
| `NCBI_API_KEY` | Optional; raises PubMed rate limit 3→10 req/s |
| `VITE_POSTHOG_KEY` | Analytics (omit on client-facing Vercel deployments) |
| `VITE_SYNCFUSION_KEY` | Syncfusion community licence (suppresses watermark) |

---

## 7. Live Supabase tables referenced in code (inventory)

`assets`, `asset_lexicon`, `trials`, `regulatory_events`, `regulatory_calendar`, `company_signals`, `financial_snapshots`, `company_summaries`, `market_intelligence`, `documents`, `label_snapshots`, `ingest_runs`, `personnel`, `unresolved_trials`. (Definitions under `supabase/*.sql` and `supabase/seeds/*.sql`.)

---

*End of context pack. Source of truth: repo root `Ariya-Signals/` at iteration-5, verified 2026-06-24. The `ariya-signals-main/` subfolder is stale — do not reference it.*
