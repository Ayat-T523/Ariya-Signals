# Ingestion Model — how Ariya fetches multi-asset data

**Date:** 27 July 2026
**Purpose:** Decide, on purpose, how Ariya gets signal data for many assets/indications without
either pre-building a giant bank or fetching everything live. Companion: `docs/multi-asset-seed-pool.md`.

---

## 1. The question

To serve "any therapeutic area, any indication," should Ariya **pre-build a bank** of signals for
every indication, or **fetch on the fly** when a user needs it? Concern: pre-building everything is
slow and expensive.

**Answer: neither extreme. The correct model is trigger-on-configure, then keep it warm.** Both pure
options are wrong for a specific, load-bearing reason.

## 2. Why pure on-the-fly breaks the product

Ariya's value is **monitoring over time** — "what changed," "new this week," label diffs, pressure
trends, alerts. **You cannot detect a change in data you didn't store.** A live fetch returns a
*snapshot*; the product sells the *delta between snapshots*. Remove the persisted historical
baseline and the War Room's entire "what needs you / what changed" premise collapses into a search
box.

Secondary reasons on-demand-per-view fails:
- **Latency + rate limits.** Fetching, parsing, entity-resolving, and AI-synthesizing across five
  sources for a full competitor set at page load takes seconds-to-minutes and trips SEC EDGAR /
  PubMed / ClinicalTrials.gov fair-access limits. Users won't wait.
- **Synthesis must be cached anyway.** `why_it_matters` / `suggested_action` are LLM calls; the
  alerts spec already mandates generate-once-and-store, never per-view. On-demand synthesis is slow,
  costly, and non-deterministic.

## 3. Why a pre-built universe bank is also wrong (the valid concern)

- It doesn't scale to "any indication" — you can't pre-ingest the whole pharma universe.
- Most configured assets are never viewed (long tail) → wasted ingestion + synthesis spend. This is
  the "cost scales with signals × assets" worry from the ideation doc.

## 4. The model — trigger-on-configure, then continuous

1. **Ingest nothing until an asset is configured.** No universe pre-build. Data exists only for
   assets someone actually picked.
2. **On configure → bounded backfill.** Kick off ingestion for that asset's competitor set, scoped
   to a recent window (e.g. last 90 days), asynchronously. Show a brief **"gathering your
   intelligence"** first-run state — which *fits* the product's "it watches so you don't have to"
   identity and the existing ingestion-processing-time pattern (upload → AI follows up when ready).
3. **Then refresh on a schedule** (daily / continuous) going forward. This forward stream is what
   produces "new this week" and the diffs — i.e. the monitoring value. The baseline from step 2 is
   what step 3 diffs against.
4. **Synthesis stays cached** (once per signal, stored) and **per-asset interpretation is lazy** —
   generated only for active assets, populating `company_signal_asset_actions` on demand.

Net: you never "fetch all the information." You fetch only the **configured slices**, **bounded** to
a recent window, **once**, then **incrementally**. Time and cost scale with *active* assets, not the
catalog — which resolves the ideation's cost concern directly.

## 5. What already exists vs. what to build

**Already built (the fetching is not from scratch):** `api/ingest/*` and the
`supabase/functions/ingest-*` edge functions already pull FDA labels, SEC deals/financials,
ClinicalTrials.gov trials, Federal Register, HTA, and IR RSS. Storage is `company_signals` +
related tables. The relevance gate (`lexiconInns` / `lexiconTaTerms` in `assets-config.ts`) already
scopes signals to an asset's TA.

**To build (the orchestration layer):**
- A **monitored-assets / subscription** concept: configured asset → a job that ingests its
  competitor universe, scoped by the asset's lexicon + `suggestedCompetitors`, then stays scheduled.
- **On-configure trigger + bounded backfill** (90d) with an async **first-run state** in the UI.
- **Per-asset scoping** through the pipelines (they currently run for the HAE set; parametrize by
  indication/competitor set from `assets-config.ts` / the future `assets` table).
- **Lazy per-asset synthesis** into `company_signal_asset_actions` (the half-built table from the
  ideation), triggered when an asset becomes active.
- **Company registry entries** for every new `suggestedCompetitors` id (see seed-pool §4).

**Honest tradeoff:** this hybrid is more orchestration than either pure extreme — you need
job-triggering, per-asset scoping, backfill, and a first-run state. But it's the only model that
both scales to "any indication" and preserves the monitoring value that is the product.

## 6. How this changes the synthesis picture

The synthesis (`why_it_matters`, `suggested_action`, and the still-empty `clean_headline`) becomes
**per-asset and lazy**, not one global Ekterly-POV pass. That's the fix for the "single-tenant
pretending to be multi-tenant" finding: the same HAE signal gets re-interpreted from each configured
asset's POV, cached per (signal × asset) in `company_signal_asset_actions`, generated only when that
asset is active. Fold the `clean_headline` backfill (round-2 R4) into this per-asset synthesis rework
so the generator is touched once, not twice.

## 7. Open questions
1. **Backfill window** — 90 days enough for a useful first load, or deeper for context? Cost tradeoff.
2. **Refresh cadence** — daily vs. near-real-time per source; some sources (SEC) are event-driven.
3. **Deactivation / retention** — when an asset is unconfigured, keep its data warm or age it out?
4. **First-run UX** — how long is acceptable before first content; notify-when-ready vs. block?
5. **Per-asset synthesis cost ceiling** — model + budget per (signal × active asset).
