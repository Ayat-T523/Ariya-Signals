# Pre-Build Hygiene Check

**Project:** Ariya Signals
**Date:** 26 July 2026
**Purpose:** Verify every specced change is wired to real code before writing build prompts. Maps each change to a real-code anchor and flags gaps/decisions that must be resolved first.
**Tree checked:** real deployed TypeScript root (`src/`), not the (now deleted) `ariya-signals-main/` prototype.

---

## 1. Readiness verdict

> **Major correction (27 Jul 2026):** this document was written *before* `docs/build-prompts.md`'s
> Phase 0 → 4 sequence ran. Everything below the original "✅ Now" verdicts in this table has
> actually **already shipped** — re-verified against the live `src/` tree, not re-derived from this
> doc's original claims. Treat the table below as current state, not a to-do list. Using the
> original version of this doc to scope new prompts would have re-requested work that's done.

| Change area | Status | Detail |
|---|---|---|
| Competitors: invisible-cards bug + paywall tile + sort/filter | ✅ **Already done** | Commit `91f3650`, Phase 1.1. Competitors.tsx *is* still legacy-styled (not InForm) and untouched by this session's InForm work — see §5 — but the functional bugs this row describes are fixed. |
| PaidGate removal (Market Implications) | ✅ **Already done** | Commit `895bff2`, Phase 1.2. Reconfirmed gone after this session's full Phase 4 rewrite of `WarRoom.tsx`. |
| PaidGate removal (SWOT) | ⚠️ **Still a real decision** | `PaidGate.tsx` now has exactly one remaining usage (`CompanyTab.tsx:376`). **No SWOT data source exists** — see §4. This is the one PaidGate item still genuinely open. |
| Remove Intelligence "Coming soon" tab | ✅ **Already done** | Phase 1.3, predates this session. Reconfirmed: no "Coming soon", no disabled tab anywhere in the current `Portal.tsx`. |
| Alerts inbox redesign (layout) | ✅ **Already done** | Phase 3.1 (commit `e940caf` + refinement passes), before this session. `AlertsPage.tsx` is a full InForm rebuild — compact grouped-by-competitor table, glass filter bar, `SlideOver` detail drawer. Not a stub. |
| Intelligence Feed event annotations | ✅ **Done this session** | Sub-step 3.3. Hardcoded `buildRegulatoryContext`/`LEADERSHIP_ANNOTATIONS` templates removed; per-event `annotation` field wired, omitted when absent. |
| War Room redesign (worklist, Direction A) | ✅ **Done this session** | Phase 4 in full (4.1 triage-state persistence, 4.2 the worklist rebuild, 4.3 keyboard triage). See `docs/frontend-status-report-2026-07-27.md` for the detailed change log. |
| `why_it_matters` de-boilerplate | ✅ **Already done** | 376/394 populated and wired — see §2. Not pipeline-gated; this was a false blocker. |
| Suggested actions (War Room worklist) | ✅ **Already done** | 243/394 populated and wired into the worklist + Alerts drawer this session. Not pipeline-gated; also a false blocker. |
| `clean_headline` de-boilerplate | ⛔ **Genuinely pipeline-gated** | 0/394 populated — see §2. The one synthesis field that's actually still missing. |
| `what_changed` (Alerts "What changed" diff) | ⛔ **Genuinely pipeline-gated** | 0/394 populated — see §2. Also actually missing, not just unverified. |
| Personalization vs. caching architecture | ✅ **Decided (27 Jul 2026)** | **Asset-scoped, confirmed by the product owner as non-negotiable — this product has no home asset.** "Any user from any brand" must be able to configure Ariya around their own tracked asset, with more assets coming. See the new §2a and §6 below — the *architecture* was already right (a real migration exists for it) but is unpopulated and unwired; that's now the actual work item, not an open question. |
| Multi-asset signal data coverage | ⛔ **New, larger gap than previously documented** | `assets-config.ts` lists 7 assets across 3 indications (HAE, PNH, PBC) — but every row in `company_signals` (394/394) is an HAE competitor. There is currently no PNH or PBC signal ingestion at all. See §2a. |

**Bottom line, corrected:** almost everything this document originally called "ready to build" is now
actually **built and shipped**. The genuinely remaining items are: SWOT (data-source decision),
`/pricing` (keep-or-remove decision), `clean_headline` + `what_changed` (real pipeline gaps),
migrating Intelligence Feed + Competitors to InForm (visual work, not blocked on anything — see §5)
— and, now confirmed as a hard product requirement rather than an open question, **wiring up
per-asset synthesis and expanding signal ingestion beyond HAE** (§2a, §6).

---

## 2. Data layer & pipeline (the crux)

**Source:** `src/lib/db/index.ts`, `src/lib/signalMapping.ts`, `src/lib/transformers.ts`. Signals come from Supabase `company_signals`; implications from `market_intelligence`.

### What already exists

- **`why_it_matters`** — a real nullable column on `company_signals` (`db/index.ts:230`). It is **not populated by ingestion** (no writes found in `api/ingest/*`), so it's usually null → the UI falls back to boilerplate. The pipeline's job is to **populate this existing column**, not create it.
- **Market implications** — real rows in `market_intelligence` (`DbMarketImplication`, `db/index.ts:269–285`: `type`, `content`, `display_order`, `period_label`, `active`). The War Room `PaidGate` is hiding **existing data**. Removing the gate + rendering `content` shows real implications immediately.
- **`severity`** — not a DB column. Derived deterministically from `signal_type` in `signalMapping.ts:37–50` (`SIGNAL_SEVERITY_MAP`). Fine to keep; can be upgraded to synthesized later.

### Synthesis fields — VERIFIED against live DB (27 Jul 2026, `company_signals`, 394 rows)

> **Correction:** an earlier draft of this section claimed `clean_headline`, `what_changed`, and
> `suggested_action` were all "missing / pending Phase 2.2." That was wrong for `suggested_action`
> (see below) but **not** for `what_changed` — a follow-up query (27 Jul 2026, same session)
> confirms it is also 0/394 populated, same as `clean_headline`. Phase 2.2 covers **both** fields,
> not just one.

| Field | Populated | Status |
|---|---|---|
| `why_it_matters` | **376/394 (95%)** | Populated, already wired. |
| `suggested_action` | **243/394 (62%)** | Populated, real event-specific text. Already wired into the worklist + Alerts drawer. |
| `ai_severity` | **243/394 (62%)** | Populated but **not consumed anywhere** — the app uses two other severity engines instead (see below). |
| `clean_headline` | **0/394 (0%)** | **Real gap.** Every headline is the fallback path (`buildReadableHeadline` / raw `headline`), which is why some rows render raw filing-dump text. `mapSignal` must stop falling back to the raw/accession headline once this is populated. |
| `what_changed` | **0/394 (0%)** | **Also a real gap — confirmed, not just unverified.** `count(what_changed)` over all 394 rows returns 0. Same situation as `clean_headline`: column exists, ingestion never writes to it. |
| `severity` (legacy col) | 15/394 | Effectively unused. |

**Two severity engines coexist, unreconciled (architectural debt):** `signalSeverity.ts`
(`computeSeverity`/`summarizeSeverity`, asset/lexicon-aware) used by Market Weather + Competitors,
vs. `signalMapping.ts` (`SIGNAL_SEVERITY_MAP` per `signal_type`) used by Alerts + the War Room
worklist/drawer. They can disagree on the same signal. Meanwhile `ai_severity` sits unused. Decide:
adopt `ai_severity` as canonical (with a fallback for the 38% unpopulated), reconcile onto one
engine, or document the split as permanent.

### Implication for prompts

Phase 2.2 is **not** "build the synthesis pipeline" — most of it already ran. It is: **(a)** find
why `clean_headline` **and** `what_changed` are both 0% (the generation step clearly runs — it
populates `why_it_matters` at 95% and `suggested_action` at 62% — but never writes these two; is it
a prompt gap, columns added after the generator was last touched, or a failing validation step
specific to these two?) and populate both; **(b)** once populated, point `mapSignal` at
`clean_headline` and drop the raw/accession fallback, and wire `what_changed` into whatever UI was
waiting on it (AlertsPage's "What changed" diff section currently has no real source for this).

---

## 2a. Multi-asset architecture — confirmed hard requirement, not a nice-to-have (27 Jul 2026)

**Product owner, verbatim:** *"it is CRITICAL that this system works for any asset, there is no
home asset for this product. The idea is any user from any brand can come and conduct competitive
research. So there are more assets coming in."* This resolves decision #1 in §6 (personalization
vs. caching) — asset-scoped, confirmed — but reveals the real gap is bigger than that one decision.

**What's already built for this:**
- `src/config/assets-config.ts` — 7 assets across 3 indications (HAE, PNH, PBC), including
  "competitor products" entries (e.g. `takhzyro`, `orladeyo`) explicitly so a user from a rival
  company can configure Ariya from *their* perspective, not just the reference persona's.
- `useConfig()` / onboarding already resolve `assetName`, `indication`, `lexiconInns`,
  `lexiconTaTerms` dynamically per the user's selected asset — signal *relevance gating*
  (`computeSeverity`, the watchlist) is already asset-aware.
- `supabase/company_signal_asset_actions.sql` — a real, already-migrated table
  (`signal_id` + `asset_id` → `suggested_action`) built for exactly this: one synthesis per
  (signal, asset) pair, not per individual user (bounded cost — see the file's own comment for the
  full reasoning). **Currently 0 rows, never queried anywhere in `src/`.** Dead schema.

**What's actually missing (verified 27 Jul 2026):**
1. **Signal data itself is 100% HAE-scoped.** Every row in `company_signals` (394/394) has a
   `competitor_id` from the HAE landscape (Takeda, BioCryst, Pharvaris, CSL Behring, Ionis,
   Intellia, Astria). There is no PNH ingestion (for the `zevaro` asset) and no PBC ingestion (for
   `chelira`) at all. Selecting either of those assets today would show an empty or wrong-context
   product, not a personalization glitch — there's no data behind them yet.
2. **AI synthesis is one global value per signal**, generated once, worded around the HAE/Ekterly
   context (confirmed: real examples explicitly say "for Ekterly" / "the Hereditary Angioedema
   treatment market"). A PNH or PBC user would see HAE-flavored `why_it_matters`/`suggested_action`
   text even once #1 above is fixed, unless synthesis is re-run per-asset into
   `company_signal_asset_actions`.
3. **`PRODUCT.md`** described David/Ekterly/HAE as the product's fixed identity rather than the
   current reference tenant — corrected in this session (27 Jul 2026).

**Scoping implication:** this is now the single biggest piece of unscoped work in this whole
document — bigger than `clean_headline`/`what_changed`. It touches ingestion (new competitor/TA
sources per indication), the synthesis pipeline (write to the asset-scoped table, not the flat
column), and the read path (`mapSignal`/`getRecentSignals` keyed by the viewer's `asset_id`). Not
attempted this session — flagged for the next round of prompts.

---

## 3. Per-page anchors (verified)

All four row counts and anchors below are re-verified 27 Jul 2026, current tree — the original
draft's numbers were stale for every page except Competitors' bug-fix status (already fixed, but
the file itself untouched by InForm work, so its old anchors below are still positionally close).

| Page | File | Verified anchors |
|---|---|---|
| Alerts | `src/pages/AlertsPage.tsx` (**517**, not 800 — full InForm rebuild, Phase 3.1, before this session) | `AlertDetail` (severity/why-it-matters/suggested-action/source, extracted this session into `src/components/inform/AlertDetail.tsx` so War Room's drawer shares it) is imported, not local; grouped-by-competitor `digest-plate` rows `~175`; glass `FeedFilterBar`; `SlideOver` drawer with prev/next + Save + Mark read. No stub — this is finished, real content. |
| War Room | `src/pages/WarRoom.tsx` (**717**, not 1416 — rewritten in full this session, Phase 4, all anchors below are current) | Rebuilt as an action-first worklist (`docs/war-room-redesign-spec.md` Direction A): `HandleMenu` `135`; `WorklistRow` `199`; roving-focus keyboard state `271`; "needs you" filter + dedup `324–345`; global keyboard-triage handler `464`; `<MarketWeather compact>` `647`; Inspect drawer `<SlideOver>` `677`. **No** `buildWhyItMatters`, KPI tiles, or `PaidGate` anywhere in the file anymore. |
| Intelligence | `src/pages/Portal.tsx` (**1917**, not 2211 — annotations reworked this session, Phase 1.3's tab removal predates it) | **No** "Coming soon" tab, `buildRegulatoryContext`, `LEADERSHIP_ANNOTATIONS`, or `haeExtract` anywhere — all confirmed gone. Current: `getEventAnnotation` `102`; `TABS` array (Events / Market Developments only) `485`; `EventCard` `706`. Still legacy-styled (not InForm) — see §5. |
| Competitors | `src/pages/Competitors.tsx` (**916**, not 864 — file grew from later, unrelated commits; the specific bug fixes from Phase 1.1 are still in place) | Grid is now **responsive** (`repeat(auto-fill, minmax(300px, 1fr))` `898`, not the old non-responsive `repeat(3,1fr)`); `variants={staggerContainer}`/`variants={listItem}` `897/903` (the invisibility-bug fix). No "paid version" text anywhere in the file — that placeholder is gone. Still legacy-styled (not InForm) — see §5. |

---

## 4. PaidGate / tiering removal map (full product = no gating)

| Location | What it gates | Removal action | Gap |
|---|---|---|---|
| ~~`WarRoom.tsx:1335`~~ | Market Implications | **Already done** — removed in Phase 1.2 (commit `895bff2`, before this doc's date), reconfirmed still gone after this session's full Phase 4 rewrite of the file. No action needed. | None — already shipped |
| `CompanyTab.tsx:376` | SWOT Analysis | Delete gate | **No SWOT data source found — still true, re-verified.** Removing the gate leaves nothing. Decision: build SWOT data, or drop the section entirely. **This is now the only remaining `PaidGate` consumer in the codebase.** |
| `PaidGate.tsx` (`src/components/ui/PaidGate.tsx`) | the component | Delete once the SWOT usage above is resolved (its only remaining caller) | None |
| `/pricing` — `App.tsx:110` (line shifted from 106), `NavPanel.tsx:60`, `PricingAndAccess.tsx` (174) | a whole pricing page + nav item | Untouched, re-verified still present. Decide: remove nav item + route (recommended for a single full product), or keep as an info page | Decision needed |

---

## 5. Cross-cutting hygiene (tech debt, not blockers)

- **Design tokens ignored — but this is now a two-page problem, not four.** Re-verified 27 Jul 2026
  (`grep -oE '#[0-9A-Fa-f]{3,8}\b'`, raw hex only — CLAUDE.md exempts `rgba(...)` strings):
  **Portal.tsx 122, Competitors.tsx 37, WarRoom.tsx 1, AlertsPage.tsx 0.** The WarRoom/AlertsPage
  numbers in an earlier draft of this doc (35 and 30) were stale — both pages were fully rebuilt in
  InForm this session (Alerts: Phase 3.1; War Room: Phase 4) and are effectively clean now.
  WarRoom's one remaining hex (`#FFFFFF`, the sort toggle's active-state text color, `WarRoom.tsx:581`)
  is a known, already-documented minor finding, not new debt. **Portal and Competitors are the real,
  unstarted remaining migration work** — no phase currently schedules either.
- **No shared clock.** `new Date()` / `Date.now()` are called ad hoc across pages. If "as-of" control matters (demos, testing), introduce one injectable `now()`; otherwise leave.
- **Data-hub rule loosely followed.** `src/data/kalvista.ts` exists but pages import some JSON directly and live data via `lib/db`. Not worth churn now.
- **`why_it_matters` inconsistency between pages — resolved, not just "will resolve."** Both
  AlertsPage and the War Room worklist now render it through the exact same `AlertDetail` component
  (extracted this session to `src/components/inform/AlertDetail.tsx`), reading the same populated
  (376/394) column. There is no boilerplate fallback left in either page for this field.
- **Two severity engines coexist, unreconciled** (see §2) — real, still-open architectural debt,
  not resolved by anything this session did.

---

## 6. Decisions to lock before the pipeline track

1. ~~Personalization vs. caching~~ **DECIDED 27 Jul 2026: asset-scoped, non-negotiable.** No home
   asset, any brand/any asset must work, more assets coming. Write to the existing
   `company_signal_asset_actions` table (signal × asset → suggested_action), not the flat
   `company_signals.suggested_action` column it's currently using. See §2a for the full scope —
   this decision alone doesn't unblock anything until ingestion also covers non-HAE indications.
2. **SWOT** — deferred to next iteration (needs a logic/data-source decision first, per the product
   owner, 27 Jul 2026). Not building now.
3. **Pricing page** — deferred to next iteration (needs to scope where the data comes from first,
   per the product owner, 27 Jul 2026). Not building now.
4. **Model + cost ceiling** for the per-signal synthesis call — still open, now higher-stakes given
   #1: cost scales with signals × assets, not just signals, once non-HAE ingestion starts.

---

## 7. Green-light now (no dependencies)

> **Correction (27 Jul 2026):** five of the original six items here are already done (see §1). What
> actually remains, with nothing blocking it:

- Remove `/pricing` nav item + route, *or* decide to keep it as an info page (decision #3, §6) —
  the only undecided item in this list.
- Migrate Intelligence Feed (`Portal.tsx`) and/or Competitors (`Competitors.tsx`) to InForm — the
  two pages War Room and Alerts already went through this session and last session respectively.
  No phase currently schedules this; it's pure frontend, no data dependency.
- Everything else originally listed here (Competitors bug fixes, Market Implications `PaidGate`
  removal, the Coming-soon tab, the Alerts inbox) is **shipped** — see §1's corrected table.

**Still genuinely blocked**, unchanged from the original doc:
- `PaidGate.tsx` deletion — waits on the SWOT decision (§4, §6).
- Anything reading `clean_headline` or `what_changed` — waits on the pipeline actually populating
  those two columns (§2).
