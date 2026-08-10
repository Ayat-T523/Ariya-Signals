# Ariya Light — Implementation Prompt Sequence (for Claude Code)

**How to use this file.** Each numbered prompt below is a self-contained instruction to paste into Claude Code, **one at a time, in order**. Do not paste the next prompt until the previous one's *Verify* gate passes and you've reviewed the diff. Every prompt carries its own guardrails and a hard STOP condition. The final prompt (Phase 6) is a full-system robustness sweep.

This sequence implements four gaps from `docs/LIGHT_GAP_CONTEXT.md`. Read that file first — it is the source of truth for current state. The decisions below were made deliberately; do not relitigate them mid-build.

---

## Locked decisions (do not change without asking the user)

| Area | Decision |
|---|---|
| **Auth** | Supabase Auth (email/password + Google/Microsoft SSO). Per-user state in Postgres with RLS. Clerk and demo-password modes are **retired**; `BYPASS_AUTH` is kept for local dev only. |
| **Per-user state** | Lives in Supabase tables keyed on `auth.uid()`, protected by RLS. Replaces the `localStorage`-only model for watchlist, tracked asset, onboarding, and read-state. |
| **ChEMBL scope** | Autocomplete resolves identity via the existing `/api/chembl/search`, but the selectable universe is **constrained to drugs within already-curated indications** (HAE, PNH, PBC). A new pick maps to an existing indication and **inherits that indication's `lexiconTaTerms` + `suggestedCompetitors`**. No open-ended sponsor or TA-term inference in v1. |
| **Alerts feed** | A **live view/query over `company_signals`** (reusing `getRecentSignals`), not a materialized `alerts` table. Vocabulary/severity mismatches are reconciled in a single mapping layer. |
| **Change detection** | **One shared snapshot+diff utility**, generalizing the `label_snapshots` pattern. `trials.ts` stops blind-overwriting so status transitions emit alerts. |
| **Messaging "no AI"** | Interpreted as *"the portal/feed must be readable without AI narrative"* — **ingest may use structured extraction**. Diff method is **hybrid**: normalized-subset hash to detect a candidate change, structured extraction only on change. |
| **Sequence** | Dependency-optimized: ChEMBL autocomplete (auth-independent) → Supabase Auth → per-user watchlist → change detection + feed → messaging drift → full-system check. |

---

## Global guardrails (apply to EVERY prompt)

1. **Work only in the repo root** (`src/`, `api/`, `scripts/`, `supabase/`). The `ariya-signals-main/` subfolder is **stale — never read or edit it**.
2. **Data import rules:** demo/static data only via `src/data/kalvista.ts`; live data only via `src/lib/db/`. Never import a JSON file or Supabase table directly into a component.
3. **Active nav is `src/components/shell/NavPanel.tsx`.** `src/components/layout/Sidebar.tsx` is legacy and not wired into `Layout.tsx` — do not edit it expecting UI changes.
4. **Design tokens only:** no raw hex anywhere in `src/`; use `var(--token-name)` / the Tailwind token classes. RGBA strings are exempt. Font family is Satoshi (`var(--font-family)`).
5. **OXC parse rule:** TypeScript `as T` casts inside JSX attribute expressions must be wrapped in parens — `style={({ ...s } as React.CSSProperties)}`, never the bare form. OXC throws even when tsc passes.
6. **After any code change:** run `npm run build` (this is `tsc && vite build`) and `npm run lint`. Both must be green before you call a step done. Then run `graphify update .` to keep the graph current.
7. **Make minimal, scoped changes.** Do not refactor adjacent code, rename things, or "tidy up" outside the stated scope. If a change you think is needed falls outside scope, STOP and report it instead of doing it.
8. **Commit per phase** with a clear message, so each phase is independently revertible. Do not squash phases together.
9. **Never invent data.** If a value, table, or column is needed and doesn't exist, STOP and report — do not stub it with fake values that look real.
10. **If a Verify check fails, do not proceed.** Fix within scope or STOP and report. Never mark a step done with a red build, red lint, or a failing functional check.

---

## Phase 0 — Baseline & grounding (no code changes)

**PROMPT 0:**

> Before changing anything, establish a green baseline and ground yourself in the codebase.
>
> 1. Read `docs/LIGHT_GAP_CONTEXT.md` in full. Read root `CLAUDE.md`. If `graphify-out/GRAPH_REPORT.md` exists, read it for god nodes and community structure.
> 2. Confirm the two source trees: verify the live code is at the repo root and `ariya-signals-main/` is stale. State which directories you will treat as in-scope.
> 3. Run `npm install`, then `npm run build` and `npm run lint`. Record the exact current pass/fail state and any pre-existing warnings — this is the baseline I will hold you to.
> 4. Confirm these anchor files exist and summarize each in one line: `api/chembl/search.ts`, `src/components/OnboardingModal.tsx`, `src/config/assets-config.ts`, `src/App.tsx`, `src/main.tsx`, `src/pages/SignIn.tsx`, `src/pages/AlertsPage.tsx`, `src/lib/db/index.ts`, `src/context/AppContext.tsx`, `supabase/functions/ingest-fda-labels/index.ts`, `api/ingest/trials.ts`, `src/components/competitor/tabs/MessagingTab.tsx`, `scripts/lib/signal-gate.mjs`.
> 5. Do **not** modify any file. Output a short readiness report.
>
> **Verify / STOP:** If `npm run build` or `npm run lint` is already red on a clean checkout, STOP and report exactly what fails. We fix the baseline before building anything new.

---

## Phase 1 — ChEMBL autocomplete (auth-independent half)

Goal: replace the static `ASSETS_CONFIG` filter in onboarding step 2 with live ChEMBL autocomplete, **constrained to curated indications**, and persist the resolved entity into `asset_lexicon`. No auth dependency yet — the user's pick stays in its current `localStorage` location until Phase 3 moves it.

**PROMPT 1A — Plan first (no edits):**

> Plan the ChEMBL autocomplete wiring. Do not edit yet — produce a plan I will approve.
>
> Context: `api/chembl/search.ts` is a working `GET /api/chembl/search?q=` endpoint returning `ChemblResult[]` (`inn, chembl_id, max_phase, drug_type, synonyms, research_codes, atc_codes, usan_stem_label`). No code in `src/` calls it today. `OnboardingModal.tsx` step 2 currently filters the static `ASSETS_CONFIG` (7 entries) in `src/config/assets-config.ts`. Each config entry carries `lexiconInns`, `lexiconTaTerms`, and `suggestedCompetitors`, and `lexiconInns`/`lexiconTaTerms` are **shared per indication** (per the comment in that file).
>
> Your plan must cover:
> 1. A debounced search hook/util that calls `/api/chembl/search` (min 2 chars), with loading/error/empty states.
> 2. **The constraint mechanism:** how a ChEMBL result is accepted only if it maps to one of the curated indications. Propose the mapping signal (e.g. match against the union of existing `lexiconInns`/synonyms per indication, or ATC/mechanism class) and what the UI shows for an in-ChEMBL-but-out-of-scope result ("not yet covered").
> 3. On selection: map the pick to its indication, **inherit that indication's `lexiconTaTerms` + `suggestedCompetitors`**, and upsert the resolved entity into `asset_lexicon` (`inn, brand_name, chembl_id, synonyms, max_phase, mechanism, fetched_at`) via the existing write path used by `scripts/chembl-lexicon-seed.mjs`. Reuse that script's upsert logic; do not invent a new one.
> 4. Where the user's selected asset id continues to live for now (unchanged `localStorage` keys — Phase 3 migrates it).
>
> List every file you will touch and why. Flag anything that requires a schema or endpoint change (there should be none).

**PROMPT 1B — Implement:**

> Implement the approved plan. Constraints:
> - Reuse `api/chembl/search.ts` as-is; do not change the endpoint.
> - The autocomplete must **fail safe**: on fetch error or empty results, fall back to showing the curated `ASSETS_CONFIG` list so onboarding is never blocked. Surface errors quietly, never crash the modal.
> - Debounce ≥250ms; cancel in-flight requests on new keystrokes.
> - Out-of-scope picks (valid ChEMBL drug, no curated indication) must be clearly non-selectable with an honest "not yet covered" message — never silently accept an asset we have no TA terms or competitors for.
> - Persist to `asset_lexicon` using the same upsert pattern as `scripts/chembl-lexicon-seed.mjs` (`onConflict: 'inn'`). Do not write fake `mechanism`/`first_approval` — leave null if ChEMBL didn't return it.
> - Keep all existing `localStorage` asset keys working unchanged.
>
> **Verify:**
> 1. `npm run build` and `npm run lint` green.
> 2. `npm run dev`, open onboarding step 2: typing ≥2 chars of a known in-scope drug (e.g. "sebetr") returns live ChEMBL results; selecting one advances onboarding and the competitors step inherits the right `suggestedCompetitors`.
> 3. Typing a real drug outside curated indications (e.g. an oncology drug) shows it as "not yet covered", not selectable.
> 4. Confirm the selected asset's resolved entity landed in `asset_lexicon` (query the table or log the upsert result).
> 5. Disconnect network / force the endpoint to 500 → onboarding still works via the static fallback.
>
> **STOP** if any Verify check fails, or if implementing this required changing the endpoint, the DB schema, or auth. Report instead of forcing it.

---

## Phase 2 — Supabase Auth + per-user foundation

Goal: real self-serve accounts via Supabase Auth, drop the role step (out of scope for Light), retire Clerk and demo-password modes, and stand up RLS-protected per-user tables. This is the keystone for Phases 3–5.

> **Pre-flight guardrail — confirm before retiring demo-password:** The shared-password mode is the *current production gate*. Before removing it, check whether any live demo deployment depends on it (search `.env.local`, `.vercel`, `vercel.json`, and deployment notes). If anything live relies on it, STOP and ask the user before deleting — offer to keep it behind a flag for one release.

**PROMPT 2A — Plan first (no edits):**

> Plan the migration from the current three-mode auth (`BYPASS_AUTH` / `DEMO_PASSWORD_MODE` / Clerk in `src/App.tsx` + `src/main.tsx`) to **Supabase Auth**. Do not edit yet.
>
> Requirements:
> 1. Email/password sign-up + sign-in, plus Google and Microsoft SSO, using Supabase Auth (`@supabase/supabase-js`, already a dependency). The sign-in UI is custom/from-scratch (not Clerk-native), so rebuild `SignIn.tsx` against Supabase's SDK — there is no Clerk UI worth preserving.
> 2. Rework `AuthGuard` in `App.tsx`: keep `BYPASS_AUTH` for local dev; replace the Clerk and demo-password branches with a Supabase session guard. Remove `<ClerkProvider>` from `main.tsx` and the Clerk env branches once nothing references them.
> 3. **Drop the role step** from `OnboardingModal.tsx` (spec: Light is single-view, no per-role tailoring). Onboarding becomes asset-first → confirm competitors. Preserve the `onboardingVersion` stamp mechanism; bump it.
> 4. New Supabase tables, all RLS-protected on `auth.uid()`:
>    - a user profile / onboarding-state row,
>    - `watched_assets` (the per-user watchlist — used in Phase 3),
>    - `read_alerts` (per-user read-state — used in Phase 4).
>    Provide the SQL as a new migration under `supabase/`. **RLS must default-deny**; write explicit per-user policies. Do not leave these tables anon-readable.
> 5. A migration path: on first authenticated load, import any existing `localStorage` onboarding/watchlist/read-state into the user's rows, then treat Supabase as source of truth.
>
> Output: every file touched, the SQL migration, the list of env vars added/removed, and a short note on how existing anon-read tables are unaffected.

**PROMPT 2B — Implement:**

> Implement the approved auth plan. Constraints:
> - Keep `BYPASS_AUTH=true` working for local dev (no gate).
> - Do not break existing anon-read data access for tables surfaced today (the Supabase getters in `src/lib/db/` must keep working). Only the **new** per-user tables get strict RLS; do not retrofit RLS onto existing read tables in this phase.
> - Remove Clerk code and env references only after confirming nothing imports them; delete `VITE_CLERK_*` / demo-password handling from the flag matrix and update `docs/LIGHT_GAP_CONTEXT.md` §6 accordingly.
> - SSO buttons must degrade gracefully if the provider isn't configured (hide, don't crash).
> - Update `.env.example` with the new required vars.
>
> **Verify:**
> 1. `npm run build` and `npm run lint` green.
> 2. Sign up with a fresh email → a row appears in `auth.users` and the user-profile table; onboarding opens; completing it persists to the profile/watchlist tables (confirm via query).
> 3. Sign out / sign in on a second browser → same watchlist/onboarding state loads (proves server-side per-user state, not localStorage).
> 4. RLS proof: with user A's session, attempt to read user B's `watched_assets`/`read_alerts` row → denied.
> 5. `BYPASS_AUTH=true` still loads the app with no gate.
> 6. Grep the repo for `Clerk`, `VITE_CLERK`, `DEMO_PASSWORD` → no live references remain (only changelog/docs mentions allowed).
>
> **STOP** if RLS lets one user read another's rows, if any existing live data read breaks, or if the pre-flight demo-deployment check was skipped.

---

## Phase 3 — Per-user watchlist migration (completes Phase 1)

Goal: move the tracked asset + watched competitors from `localStorage` into the RLS-protected `watched_assets` table, now that identity exists.

**PROMPT 3:**

> Move per-user asset/watchlist state from `localStorage` to the `watched_assets` table created in Phase 2.
>
> Context: today `AppContext.tsx` owns watchlist/asset state in `localStorage` (`ariya-user-asset-id`, `trackedAssets`, `pharma-inc-ciwarroom-watched`, etc.) and on asset selection calls `getLexiconByInn()` to set `liveLexiconInns`. The Phase 1 ChEMBL pick currently lands in those localStorage keys.
>
> Do:
> 1. Read/write watchlist + tracked asset through `watched_assets` (keyed on `auth.uid()`), via new typed getters/writers in `src/lib/db/`. Keep `localStorage` as an offline cache/fallback only, not the source of truth.
> 2. Preserve the `getLexiconByInn()` → `liveLexiconInns` behavior; the ChEMBL entity persisted in Phase 1 should now also create the user's `watched_assets` row.
> 3. Keep the `BYPASS_AUTH` dev path functional (fall back to localStorage when there's no session).
>
> **Verify:**
> 1. Build + lint green.
> 2. Add an asset via onboarding → row in `watched_assets` for the current user; reload on another device/browser → same asset tracked.
> 3. Watch/unwatch a competitor → reflected in the table and across sessions.
> 4. `liveLexiconInns` still populates from `asset_lexicon` for the tracked asset.
>
> **STOP** if watchlist state still reads from `localStorage` as source of truth, or if two different users on the same browser now share watchlist state (they must not).

---

## Phase 4 — Change detection + live alerts feed

Two parts: (4A) one generalized snapshot+diff utility and the `trials.ts` fix; (4B) wire `AlertsPage` to live `company_signals` with a mapping layer and per-user read-state.

**PROMPT 4A — Generalized diff engine + trials fix (plan, then implement):**

> First plan, then implement after I approve.
>
> Context: `supabase/functions/ingest-fda-labels/index.ts` is the only real diff engine — it keeps `label_snapshots` (`application_no, sections_hash, label_version, raw_label_json`), seeds a baseline on first run **without emitting a signal**, and on hash change writes a `signal_type='label_update'` row to `company_signals` then updates the snapshot. `scripts/lib/signal-gate.mjs` `isDuplicate()` is only a content-hash existence check (catches re-inserts, not changes). `api/ingest/trials.ts` does `upsert(batch, { onConflict: 'nct_id', ignoreDuplicates: false })` — it **overwrites** the prior row, so a Recruiting→Completed transition leaves no trace and emits no alert. The CT.gov payload already exposes `status.overallStatus` and `sponsorCollaboratorsModule.leadSponsor.name`.
>
> Plan:
> 1. Extract a **shared, reusable snapshot+diff utility** (generalize the `label_snapshots` pattern) usable by trials, messaging (Phase 5), and future sources. Define: a generic snapshot store (entity key, content hash, raw payload, version), first-run-seeds-no-signal semantics, and a `diff()` that returns the changed field(s). Put it where both `/api` (TS) and `scripts`/edge functions can use it; if runtimes differ (Vercel Node vs Deno vs mjs), state the sharing strategy honestly rather than forcing one module.
> 2. Apply it to trials: stop blind-overwriting. On ingest, compare incoming status/fields against the stored snapshot; on a meaningful change emit a `company_signals` row (a trial status-change signal) **then** update; on first sight, seed baseline with no signal. Preserve prior state (snapshot/history table) so the transition is diffable.
>
> Implementation constraints:
> - First run must **never** flood the feed — seeding a baseline emits zero signals. Add an explicit test/log proving first-run-silence.
> - Do not change the `company_signals` schema unless strictly necessary; if a column is needed, add it via migration and document it.
> - Keep `isDuplicate()` dedup intact for genuinely-new items.
>
> **Verify:**
> 1. Build + lint green; edge/serverless functions still deploy-valid (typecheck `tsconfig.api.json` where relevant).
> 2. Run trials ingest twice on unchanged data → second run emits **no** new signal.
> 3. Simulate a status change on one trial → exactly one status-change `company_signals` row is written, and prior status is still recoverable from the snapshot/history.
>
> **STOP** if first-run seeding emits signals, if the diff overwrites prior state before diffing, or if you had to broadly refactor `signal-gate.mjs` beyond adding the shared util.

**PROMPT 4B — Wire AlertsPage to live signals (plan, then implement):**

> First plan, then implement after I approve.
>
> Context: `src/pages/AlertsPage.tsx` imports static `alerts.json`/`competitors.json`/`themes.json` and builds `TYPE_CONFIG` from hyphenated keys (`trial-update`, `label-change`, `exec-move`, …). Live data lives in `company_signals`, queryable via `getRecentSignals(limitDays, competitorIds?)` in `src/lib/db/index.ts` (already feed-shaped, returns `DbRecentSignal[]`), but nothing renders it. The DB uses different vocab: `signal_type` values like `deal/press_release/exec_change/label_update/hta_decision/...`, severity `HIGH/MEDIUM/LOW`. The UI expects hyphenated types and `high/medium/low/critical`. `company_signals.why_it_matters` already holds the "why it matters" line.
>
> Decision already made: alerts are a **live query/view over `company_signals`**, not a materialized table. Do not build an `alerts` table.
>
> Plan:
> 1. A single **mapping layer** (one module) that translates a `DbRecentSignal` → the alert shape `AlertsPage` renders: `signal_type` → UI type key, severity casing normalization (decide how to treat the UI's unused `critical` — document the choice), `why_it_matters` → "why it matters" strip, UUID `id` as the stable key. All vocab reconciliation lives here, nowhere else.
> 2. Replace the static imports with a fetch through `getRecentSignals` (+ existing competitor data source). Preserve every existing feature: list/grouped views, severity sort, multi-select Competitor/Type/Source filters, unread chips, mark-read / mark-all-read, and the "What changed" diff panel (now fed by the label/trial diffs from 4A where present).
> 3. **Read/unread state** moves to the per-user `read_alerts` table (Phase 2), keyed on the signal UUID, replacing the `localStorage` Set seeded from `alerts.json`.
> 4. For grouping/themes: there is no live theme cluster source — keep the feed **flat** for Light (the grouped/themed view may be hidden or degraded gracefully). Do not fabricate clusters.
>
> Implementation constraints:
> - Empty/loading/error states must be real (use existing `SkeletonAlertList`); an empty `company_signals` must render an empty-state, not a crash.
> - Keep `alerts.json` in the repo but no longer imported by `AlertsPage` (Phase 6 will flag it as dead if truly unused).
>
> **Verify:**
> 1. Build + lint green.
> 2. Feed renders live `company_signals` rows; filters by competitor/type/source work against live data; severity sort works with normalized casing.
> 3. Mark-read persists to `read_alerts` and survives reload + cross-device.
> 4. A label/trial change from Phase 4A appears as an alert with a working "What changed" panel.
> 5. With zero matching signals, the page shows an empty state, not an error.
>
> **STOP** if any existing feed feature regresses, if read-state still uses localStorage as source of truth, or if vocab mapping is scattered across components instead of one layer.

---

## Phase 5 — Competitor messaging drift

Goal: snapshot competitor website/product messaging, diff weekly, emit a `messaging_shift` signal that flows into the Phase 4 feed and populates the existing `MessagingTab` UI. Reuses the Phase 4A diff utility.

**PROMPT 5 — Plan first, then implement:**

> First plan, then implement after I approve.
>
> Context: `MessagingTab.tsx` already renders `AnnouncementsSection` and `SourceDocsSection` (live) plus `CurrentMessageCard` / `TimelineCard` (with a `shiftDetected` "⚡ Shift detected" badge) / `ComparisonTable` — but `competitor.messaging` is never populated, so it shows the "Messaging data not yet available" stub. The scraping framework exists and is proven: `scripts/lib/firecrawl.mjs` + `ingest-*-firecrawl.mjs` (Firecrawl v2 REST). The anti-hallucination guard `titleInMarkdown()` lives in the ingest scripts (e.g. `scripts/ingest-csl-firecrawl.mjs`) and cross-validates every extracted title against the real page markdown. The Phase 4A diff utility and `label_snapshots` pattern are the template.
>
> Locked decisions for this phase:
> - "No AI" means **the portal must be readable without AI narrative** — ingest **may** use structured extraction.
> - Diff method is **hybrid**: normalize the scraped page (strip nav, cookie banners, rotating/boilerplate content), hash the normalized core to detect a *candidate* change; only on a candidate change run Firecrawl structured extraction of "core message + pillars" and do a field-level diff to confirm a real shift. This avoids false "shift detected" from marketing-page noise.
>
> Plan:
> 1. A `messaging_snapshots` store mirroring `label_snapshots`, using the Phase 4A shared diff util. First scrape seeds baseline, no signal.
> 2. A new `ingest-messaging-firecrawl.mjs` (reusing `firecrawl.mjs`) that scrapes a **defined, small list** of competitor URLs. The URL list is config-driven and reviewed — do not scrape arbitrary domains. State which competitors/URLs you propose and ask me to confirm the list before first run.
> 3. On a confirmed shift, write a `company_signals` row (`signal_type` for messaging shift — reconcile with the Phase 4 mapping layer) with a populated `why_it_matters`, so it appears in the alerts feed.
> 4. Populate `competitor.messaging` (via the live data path, not static JSON) so `CurrentMessageCard`/`TimelineCard`/`ComparisonTable` render, and `shiftDetected` reflects the real diff.
>
> Implementation constraints:
> - Reuse `firecrawl.mjs` and the `titleInMarkdown()` anti-hallucination guard (pattern in `ingest-csl-firecrawl.mjs`); do not bypass it.
> - Normalization must be deterministic and documented (what gets stripped). The hybrid gate must demonstrably not fire on a re-scrape of unchanged core content with a rotating banner.
> - Respect the existing ingest cadence/secrets (`INGEST_SECRET`, service-role key); weekly refresh.
> - Add the new `signal_type` and `data_source` values to the Phase 4 mapping layer and to the `company_signals` vocab notes.
>
> **Verify:**
> 1. Build + lint green; new script runs under `node --env-file=.env.local`.
> 2. First run on a competitor URL seeds a snapshot and emits **no** signal.
> 3. Re-run on unchanged core (with a deliberately changed rotating banner) → **no** signal (hybrid gate holds).
> 4. Simulate a real pillar/message change → one `messaging_shift` signal written, visible in the alerts feed, and `MessagingTab` shows the `shiftDetected` badge + comparison.
> 5. The "Messaging data not yet available" stub no longer shows for a competitor with snapshots.
>
> **STOP** if the diff is raw-text-hash only (must be hybrid), if it fires on rotating-banner noise, if it scrapes URLs outside the confirmed list, or if `competitor.messaging` is filled from static JSON instead of live data.

---

## Phase 6 — Full-system robustness sweep (final)

This prompt is a **read-and-report-first** audit. It must not silently "fix" things — it produces a findings report, and only applies fixes that are unambiguous and in-scope, listing each. Run it after all phases are merged and green.

**PROMPT 6:**

> Do a full-system robustness and stability sweep of the repo root (ignore `ariya-signals-main/`). Produce a written report grouped by the categories below. For each finding: file/line, severity (blocker / should-fix / nit), and recommended action. Apply only unambiguous, in-scope fixes and list every fix you make; for anything judgment-heavy, report and ask — do not guess.
>
> **A. Build, types, and lint integrity**
> - `npm run build` (tsc + vite/OXC) and `npm run lint` fully green; list every remaining warning.
> - Typecheck the API/edge tsconfigs (`tsconfig.api.json`, etc.) — serverless/Deno code included, not just the app.
> - Confirm the OXC JSX-cast parenthesization rule isn't violated anywhere new.
>
> **B. Dead code**
> - Run a dead-code pass (e.g. `npx knip` or `npx ts-prune`) and a dependency pass (`npx depcheck`). Report unused exports, unreferenced files, and unused dependencies.
> - Specifically check: is `src/data/alerts.json` still imported anywhere after Phase 4? Is `src/components/layout/Sidebar.tsx` (legacy nav) referenced? Are the retired Clerk/demo-password code paths fully gone? Are any `ASSETS_CONFIG`-only code paths now orphaned by ChEMBL wiring?
> - Do **not** delete anything that's a documented intentional fallback (e.g. `assets-config.ts` as offline seed) — flag, don't remove.
>
> **C. Broken code & links**
> - Find broken imports, dangling references, and any `signal_type`/severity vocabulary still unreconciled outside the Phase 4 mapping layer.
> - Check React Router routes in `App.tsx`: every declared route reachable; every nav link in `NavPanel.tsx` points to a real route; no dead `href`/`to`.
> - Check that every Supabase getter in `src/lib/db/` is null-safe (returns `[]`/null gracefully when env keys are missing) and that callers handle empty results.
>
> **D. Unwired components & orphans**
> - Components/hooks defined but never rendered/used; routes with no link; `/api` endpoints with no caller; Supabase tables written but never read, or read but never written.
> - Cross-check against `graphify`: run `graphify update .` then inspect `GRAPH_REPORT.md` for god nodes and orphan/island nodes introduced by this work.
>
> **E. Stability & robustness**
> - Loading / empty / error states present on every newly live-wired surface (onboarding autocomplete, alerts feed, messaging tab). No surface should crash on empty data or a failed fetch.
> - Error boundaries / unhandled promise rejections around new async paths.
> - **RLS audit:** the new per-user tables (`watched_assets`, `read_alerts`, user profile) default-deny and have explicit per-user policies; no per-user table is anon-readable/writable. Confirm existing anon-read tables are unchanged.
> - **First-run-silence audit:** confirm every diff path (labels, trials, messaging) seeds baseline without emitting signals on first run.
> - **Env-flag matrix coherence:** `BYPASS_AUTH` still works for dev; removed Clerk/demo vars are gone from `.env.example`, `docs/LIGHT_GAP_CONTEXT.md` §6, and code.
> - **Static↔live split:** report any remaining places a UI reads static JSON where it should now read live Supabase (the split that caused these gaps) — flag, don't auto-rewire.
>
> **F. Summary**
> - A prioritized punch list (blockers first), the fixes you applied, and the items needing my decision.
>
> **Verify / STOP:** Re-run `npm run build` + `npm run lint` after any fixes — both must be green. If a blocker can't be fixed in scope, STOP and surface it at the top of the report. Do not close out the sweep with a red build or an unaudited RLS/ first-run-silence path.

---

## Appendix — quick reference

**Per-phase gate (run every time):**
```
npm run build      # tsc && vite build (OXC) — must be green
npm run lint       # must be green
graphify update .  # keep the graph current after code changes
```

**Rollback:** each phase is its own commit. To undo a phase, revert its commit; later phases depending on it will need reverting too (3 depends on 2; 4B read-state depends on 2; 5 depends on 4A).

**Decision provenance:** all locked decisions trace to `docs/LIGHT_GAP_CONTEXT.md` and the design discussion that produced this file. If reality contradicts a stated fact mid-build (a file moved, a column differs), STOP and report the discrepancy rather than coding around it.

---

## Appendix — `company_signals` vocab notes

These are the notes Phase 5 (step "Add the new `signal_type` and `data_source` values to the Phase 4 mapping layer and to the `company_signals` vocab notes") and the Phase 6 sweep ("vocabulary still unreconciled outside the Phase 4 mapping layer") refer to. This is the canonical home for `signal_type` vocabulary. A new `signal_type` is not done until it appears in this table.

**Two consumers, not one.** `signal_type` is read in two separate places and a new value must be added to both:

1. **The Phase 4B mapping layer** — presentation. `signal_type` to UI type key, plus severity casing.
2. **`src/lib/deterministic/facets.ts`** — semantics. `signal_type` to *arc* (ordering inside a thread) and to *theme* (the browse and filter facet). Both are derived from `signal_type` alone, so they stay deterministic with no model involved.

Arc display order is fixed: `trial, evidence, regulatory, commercial, ip, deal, personnel`.

| `signal_type` | Arc | Theme | Emitted by |
|---|---|---|---|
| `trial_update` | trial | Pipeline and trials | trials ingest |
| `publication` | evidence | Evidence | publication ingest |
| `congress_abstract` | evidence | Evidence | congress ingest |
| `regulatory_catalyst` | regulatory | Regulatory | regulatory ingest |
| `hta_decision` | commercial | Market access | HTA ingest |
| `press_release` | commercial | Commercial | IR and press ingest |
| `exclusivity_listing` | ip | IP and exclusivity | exclusivity ingest |
| `patent_grant` | ip | IP and exclusivity | patent ingest |
| `ip_litigation` | ip | IP and exclusivity | litigation ingest |
| `deal` | deal | Deals and BD | deal ingest |
| `exec_change` | personnel | Leadership | exec ingest |
| `label_update` | regulatory | Regulatory | `supabase/functions/ingest-fda-labels` |
| `trial_status_change` | trial | Pipeline and trials | trials ingest (Phase 4A diff) |
| `earnings` | commercial | Commercial | IR ingest |
| `messaging_shift` | commercial | Commercial | `scripts/ingest-messaging-firecrawl.mjs` (Phase 5) |
| `ir_rss` | commercial | Commercial | IR RSS ingest |

The first 11 rows are the original taxonomy. The last 5 are **forward coverage**: the ingest paths listed emit them, but as of 2026-07-27 none has a live row. Verified against prod: 287 rows spanning only 8 types (`publication` 147, `press_release` 73, `exec_change` 17, `congress_abstract` 15, `regulatory_catalyst` 11, `hta_decision` 9, `deal` 8, `trial_update` 7). The 3 IP types have no live rows either. Mapping them ahead of time is worth it because `label_update` and `messaging_shift` are both graded `'high'` in `signalMapping.ts`, so the first one ingested would show as high-importance while sitting in the unclassified bucket.

**Arc and theme coverage are compiler-coupled, not convention.** `SIGNAL_TYPE_TO_THEME` is typed `Record<KnownSignalType, Theme>` where `KnownSignalType = keyof typeof SIGNAL_TYPE_TO_ARC`. Adding an arc without a theme fails the build with TS2741, so the drift this table exists to prevent cannot recur silently. Verified by probe on 2026-07-27. This matters because `themesPresent()` builds the filter bar only from themes the data can satisfy, so a type with an arc and no theme would be orderable but unreachable from the UI.

Theme is finer-grained than arc and the two deliberately disagree in one place: `hta_decision` is arc `commercial` but theme `Market access`, because a payer decision groups with commercial events yet a reader browses it as access.

**Arc labels describe the bucket, not its most common member.** `ARC_LABEL.commercial` reads "commercial update", not "company announcement", because the commercial arc also holds `hta_decision` (a payer's decision, not the company's) and `messaging_shift` (undisclosed website drift the company never announced). Both would be described dishonestly by "announcement". Any future arc label has the same obligation: it must be true of every member type, since `describeArcMix` uses it in reader-facing captions.

**Never guess.** `arcOf()` and `themeOf()` return `null` for an unrecognised `signal_type` rather than falling back to a default. Any summary that counts signals must therefore account for the unmapped bucket explicitly (see `describeArcMix`, whose parts always sum to the total) so a displayed count can never contradict its own caption.
