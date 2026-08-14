# Backend Replacement Plan — Phase 0 Recon

STEP 2 of the Ariya Light CI two-step sequence. Recon + a written plan only —
**no code changes, no migrations, no infrastructure stood up in this pass.**
Executing anything below is a later, separate, explicitly-confirmed step, per
this repo's own `docs/ARIYA_LIGHT_IMPLEMENTATION_PROMPTS.md` phase-gate
convention (each phase is its own reviewed, revertible commit; nothing
proceeds past a red Verify gate).

**Sources used for this recon:** `src/lib/db/index.ts`,
`src/hooks/useCompetitorSupabase.ts`, `src/context/AppContext.tsx`,
`src/components/OnboardingModal.tsx`, every `.sql` file under `supabase/`
(root, `migrations/`, `seeds/`), all 5 `supabase/functions/*` Edge Functions,
`scripts/ingest-eu-hta-firecrawl.mjs`, `scripts/ingest-congress-abstract.mjs`,
`scripts/ingest-congress-firecrawl.mjs`, `scripts/purge-ai-columns.mjs`,
`SYSTEM_STATE.md`, `docs/ARIYA_LIGHT_IMPLEMENTATION_PROMPTS.md`,
`src/config/assets-config.ts`, and the finished Python pipeline's own
`V1_MULTIDISEASE_STATE_FOUNDATION.md` / `models.py` / `pipeline.py`. Where
`SYSTEM_STATE.md` and the live code disagreed, the live code was treated as
authoritative and the discrepancy is called out explicitly below, per this
prompt's own instruction not to trust it blindly.

---

## 1. Postgres / self-hosting resolution

**Resolved directly with the user:** the target Postgres is a **bare, empty
instance** — nothing on it yet, intended specifically to host the self-hosted
Supabase stack. This is the simpler of the two paths named in the STEP 2
prompt (no existing data to preserve/migrate around).

**Concrete setup steps, once execution begins (not done in this pass):**

1. Pull Supabase's official self-hosting reference
   (`docker-compose.yml` + `.env` template from `supabase/supabase`'s
   `docker/` directory) rather than hand-rolling GoTrue/PostgREST/Realtime/
   Kong configuration — this is explicitly the "supported self-hosting setup"
   the STEP 2 prompt names, not a from-scratch reimplementation.
2. Point the compose stack's Postgres connection at the user's bare instance
   instead of the bundled container Postgres the reference compose file
   normally starts, OR run the bundled Postgres container itself on that
   instance — both are valid within Supabase's own reference; which one
   depends on whether the "bare instance" is a managed Postgres service
   (RDS-style, no Docker access) or a host the user can also run containers
   on. **This distinction was not asked in this pass and needs a follow-up
   answer before execution** — see open question below.
3. Bootstrap runs Supabase's own `auth`/`storage`/`realtime`/`_supavisor`
   schema migrations against the bare instance (bundled in the reference
   compose's `db` service init scripts) — this is what makes GoTrue/
   PostgREST/Realtime work at all against a instance that starts genuinely
   empty.
4. Recreate the **application** schema on top of that bootstrap. Critically,
   per §2 below, `supabase/*.sql` in this repo is **not sufficient by itself**
   to reproduce the live schema — at least four real, currently-live database
   objects have no corresponding tracked migration anywhere in this repo
   (§2's "Undocumented schema drift" list). Before cutover, the actual live
   Supabase Cloud schema must be dumped directly (`pg_dump --schema-only`
   against the current production project, or `supabase db dump`) and used
   as the ground truth for the self-hosted instance's application schema —
   not reconstructed by replaying the `.sql` files in this repo, which are
   demonstrably incomplete.
5. Point `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (browser) and
   `SUPABASE_SERVICE_ROLE_KEY` (Python pipeline + any remaining server-side
   ingest) at the self-hosted stack's Kong gateway URL and its own generated
   anon/service-role JWTs. No change to `src/lib/supabase.ts` — same
   `createClient(url, anonKey)` call, same env var names, confirmed by
   reading that file directly.

**Open question, not resolved in this pass:** does "bare Postgres instance"
mean a host the team can also run Docker Compose/containers on directly
(the straightforward path — run Supabase's reference compose file there),
or a managed Postgres-as-a-service instance with no container/OS access
(which would require running GoTrue/PostgREST/Realtime/Kong as separate
compute pointed *at* that managed Postgres, a materially different and more
involved setup)? This changes the concrete infrastructure shape and should
be confirmed before execution begins.

---

## 2. Full read-contract inventory

### 2.1 Every table, column, and query read by the frontend

Reconstructed by reading `src/lib/db/index.ts` (the single sanctioned data
layer per `CLAUDE.md`'s own rule — "always import data from `kalvista.ts`"
for static data, and confirmed by grep that no component queries Supabase
directly except `AppContext.tsx` and `OnboardingModal.tsx`, both listed
below) and `src/hooks/useCompetitorSupabase.ts` line by line.

| Table | Columns selected | Filters / order | Called from |
|---|---|---|---|
| `assets` | `id, inn, synonyms, mechanism, max_phase, approval_date, manufacturer_current, drug_class_detail, indication_type, competitor_id, indication_tags` | none (fetched whole) | `getAllAssets()` → `useCompetitorSupabase` |
| `trials` | `id, nct_id, asset_id, company_id, title, phase, status, brief_summary, start_date, completion_date, conditions, sites_count, raw_json` | `.in('asset_id', ids)`, order `start_date desc` | `getTrialsByAssetIds()` |
| `trials` | same columns | `.in('asset_id', matched)` via `assets.indication_tags` overlap (`ov` filter) on `competitor_id` | `getTrialsByCompetitorAndIndication()` |
| `trials` | `id, nct_id, asset_id, company_id, title, phase, status, start_date, completion_date` | `.in('company_id', ids)`, date-range on `start_date`, order asc | `getTrialsForCalendarYear()` |
| `regulatory_events` | `id, asset_id, event_type, date, authority, headline, details` | `.in('asset_id', ids)`, order `date desc` | `getRegulatoryEventsByAssetIds()` |
| `regulatory_calendar` | `id, event_type, title, start_date, end_date, source_url` | order `start_date asc` | `getRegulatoryCalendar()` |
| `financial_snapshots` | `id, competitor_id, fiscal_year, total_revenue_raw, total_revenue_usd, currency, rd_expense_raw, rd_expense_usd, hae_revenue_usd, exchange_rate_usd, filing_date, source_url` | `.eq('competitor_id', id)`, order `fiscal_year desc`, `limit 3` | `getFinancialsByCompetitorId()` |
| `company_signals` | `id, competitor_id, signal_type, date, headline, body_excerpt, items, source_url, accession_number, data_source, created_at, date_precision` | `.eq('competitor_id', id)`, order `date desc`, `limit 20` | `getSignalsByCompetitorId()` |
| `company_signals` | same columns | `.eq('competitor_id', id).eq('signal_type','hta_decision')`, `limit 20` | `getHtaSignalsByCompetitorId()` |
| `company_signals` | `competitor_id, date` only | `.gte('date', cutoff)`, order `date desc`, optional `.in('competitor_id', ids)` | `getAllSignalsSummary()` |
| `company_signals` | full column set above | `.gte('date', cutoff)`, order desc, optional competitor filter | `getRecentSignals()` |
| `company_signals` | full column set above | `.eq('competitor_id', id).eq('signal_type','messaging_shift')`, `limit 10` | `getMessagingSignals()` |
| `company_summaries` | `competitor_id, competitor_summary, summary_updated_at` | none | `getCompetitorSummaries()` |
| `market_intelligence` | `id, type, content, display_order, period_label` | `.eq('active', true)`, order `display_order asc` | `getMarketImplications()` |
| `documents` | `id, competitor_id, source_url, document_type, source_label, date_published, word_count, ingested_at` | `.eq('competitor_id', id)`, order `date_published desc` | `getDocumentsByCompetitorId()` |
| `asset_lexicon` | `inn, brand_name, synonyms, competitor_id` | order `inn` (fetched whole) | `getAssetLexicon()` |
| `user_profiles` | `user_id, indication, asset_id, asset_name, onboarding_complete, onboarding_version` | `.eq('user_id', id).maybeSingle()` | `getUserProfile()` |
| `watched_assets` | `competitor_id` | `.eq('user_id', id)` | `getWatchedCompetitorIds()` |
| `read_alerts` | `alert_id` | `.eq('user_id', id)` | `getReadAlertIds()` |
| `messaging_snapshots` | `competitor_id, content_hash, core_message, pillars, source_url, scraped_at` | `.eq('competitor_id', id).maybeSingle()` | `getMessagingSnapshot()` |

**Writes** (also in the sanctioned data layer, or in the two direct-call
sites below — these matter equally, since the new backend must not just
serve reads, it must not break these paths either):

| Table | Operation | Caller |
|---|---|---|
| `user_profiles` | `upsert` (patch + `updated_at`) | `upsertUserProfile()`; also a first-sign-in migration upsert in `AppContext.tsx` (`migrateLocalStorageToSupabase()`) |
| `watched_assets` | `delete` all for user, then bulk `insert`; also single `upsert`/`delete` | `upsertWatchedCompetitors()`, `addWatchedCompetitor()`, `removeWatchedCompetitor()`; also migration upsert in `AppContext.tsx` |
| `read_alerts` | `upsert` / `delete` / batched `upsert` (100-row chunks) | `markAlertReadDb()`, `markAlertUnreadDb()`, `markAllAlertsReadDb()`; also migration upsert in `AppContext.tsx` |
| `asset_lexicon` | `upsert` (`onConflict: 'inn'`) | `OnboardingModal.tsx`'s `upsertToLexicon()` — a **browser-side, anon-key write** from the ChEMBL-autocomplete onboarding flow, not just a service-role ingest write |

**Direct-call sites outside `src/lib/db/index.ts`** (confirmed by grepping
all of `src/` for `.from(`): `AppContext.tsx` reads/writes `user_profiles`,
`watched_assets`, `read_alerts` directly (the migration function above); no
other component bypasses the sanctioned data layer.

### 2.2 RLS policies and access tiers

Grepped every `.sql` file for `auth.uid()`, `ENABLE ROW LEVEL SECURITY`, and
`grant select`. Three real access tiers exist:

**Anon-readable (no RLS, or RLS + a public `USING (true)` SELECT policy):**
`assets`, `trials`, `regulatory_events` — grant/RLS statement **not found in
any tracked file** for these three; they evidently inherited an
initial-project-setup wildcard grant, exactly the situation
`grant_anon_read.sql`'s own comment describes for tables created after that
point. `financial_snapshots`, `company_signals` (explicit grant via
`grant_anon_read.sql`), `documents` (RLS enabled + explicit `USING (true)`
policy), `company_summaries` (RLS enabled + explicit policy),
`market_intelligence` (explicit grant, no RLS), `regulatory_calendar`
(explicit grant, RLS **disabled** outright), `messaging_snapshots` (explicit
grant, no RLS — comment states "No RLS needed... non-sensitive competitor
positioning data"), `personnel` (RLS enabled + public SELECT policy, write
restricted to `service_role`), `asset_lexicon` (RLS enabled; SELECT policy
added **later**, `20260727_asset_lexicon_public_read.sql` — its own comment
records that the table shipped with RLS enabled and zero policies for a
period, meaning the live-lexicon feature "had never once worked" until that
migration; writes stay anon/authenticated-denied, service-role only).

**Per-user, default-deny (`RLS enabled`, policy `USING (user_id = auth.uid())`,
no anon grant issued at all):** `user_profiles`, `watched_assets`,
`read_alerts` — all three defined together in
`migrations/20260624_user_profiles.sql`, each with an identical
`for all using (user_id = auth.uid()) with check (user_id = auth.uid())`
policy. These are genuinely invisible to anonymous callers, by design.

**Service-role-only (no anon grant found anywhere):** `hta_decisions`
(written only by the `ingest-hta` Edge Function using the service-role
key), `ingest_runs`, `ingest_errors` (ops/audit tables).

### 2.3 Undocumented schema drift — a load-bearing finding for §1

Verified directly, not assumed: **the live database schema has diverged
from what is tracked in this repo's `.sql` files**, in at least these four
confirmed ways —

1. **`asset_lexicon`'s `CREATE TABLE` does not exist anywhere in this
   repo.** Only a later RLS-policy migration (`20260727_...`) references it,
   and several seed/cron files write to it. The table itself was evidently
   created outside version control (Supabase dashboard / SQL editor,
   directly against production).
2. **`ingest_runs`** is written by all 5 Edge Functions
   (`ingest-hta`, `ingest-pubmed`, `ingest-federal-register`, `ingest-ir-rss`,
   `ingest-fda-labels`) and listed in `SYSTEM_STATE.md`'s own table
   inventory, but has **no `CREATE TABLE` anywhere in this repo** either.
3. **`company_signals.data_source`** is read by `src/lib/db/index.ts` and
   written by multiple Edge Functions/scripts, referenced only in SQL
   *comments* (`cron_pubmed.sql`, `cron_ir_rss.sql`) — no
   `ALTER TABLE ... ADD COLUMN data_source` exists anywhere, unlike its
   sibling columns `asset_id`/`inn`/`nct`, which **do** have a tracked
   migration (`20260725_company_signals_identity_columns.sql`).
4. **`company_signals.severity`** is written by `ingest-pubmed`'s Edge
   Function (via a deterministic `classifySeverity()`) and referenced by
   name in `ingest-congress-abstract.mjs`'s own comment as having been
   "added via `add_company_signals_severity_column` migration" — **no such
   file exists in this repo.**

**Implication for §1:** a self-hosted schema built only by replaying this
repo's tracked `.sql` files would be missing at least these four real
objects. `pg_dump --schema-only` (or `supabase db dump`) against the actual
live project is the only reliable source of truth for the cutover schema —
treat every `.sql` file in this repo as informative, not authoritative,
exactly as this recon prompt itself warned about `SYSTEM_STATE.md`.

Two more things worth naming here: `supabase/schema.sql` is a **stale,
superseded schema** — it defines a `messaging_snapshots` table with a
completely different column shape (`company_id, url, snapshot_date,
content_hash, content_excerpt, changed_from_prior`) than the one actually in
use (`migrations/20260624_messaging_snapshots.sql`'s `competitor_id,
content_hash, core_message, pillars, source_url, scraped_at` — the shape
`db/index.ts` and the frontend actually read). It also defines tables never
referenced anywhere in live code (`hta_decisions` with a different shape
than the real one `ingest-hta` writes, `press_releases`, `publications`,
`congress_events`, `congress_abstracts`, `alerts`, `filings`,
`user_watched_assets`/`user_watched_companies`/`user_keywords` keyed on a
Clerk `text` userId — this whole file predates the Supabase-Auth migration
documented in `docs/ARIYA_LIGHT_IMPLEMENTATION_PROMPTS.md`'s "Locked
decisions" table, which retired Clerk). **Do not use `schema.sql` as a
reference for the live schema at all** — it is historical, not current.

Separately, `assets` carries roughly 25 additional columns beyond what
`db/index.ts` selects — `inn_stem`, `inn_full`, `drug_class_detail`,
`mechanism_target`, `cascade_level`, `warnings`, `contraindications`,
`dosing_regimens`, `storage_model`, `manufacturer_roles`, `generic_andas`,
etc. (`add_drug_detail_columns.sql`). These are populated **once, by hand**,
via `seed_classification.sql`'s per-drug `UPDATE` statements sourced from
"manual FDA assessments... require clinical judgement" (that file's own
comment) — not by any live ingest, TS or otherwise. This is reference data
that neither side's pipeline currently regenerates automatically; see §3.

### 2.4 A real data-governance constraint that applies to any replacement backend

`scripts/purge-ai-columns.mjs`'s own docstring states the product's
governance rule directly: **"pharma signals were not to be sent through
non-enterprise model data handling"** — this is why `company_signals`
carries dead `ai_*` columns being actively purged (the feed used to run
signals through an LLM; that path was removed on data-governance grounds,
not for quality reasons). `severity` was deliberately *kept* because it is
written by a **deterministic** classifier, explicitly not AI output.

This directly bears on the replacement: the Python pipeline is itself fully
deterministic — no LLM call exists anywhere in `pipeline.py`,
`extraction.py`, or any adapter (confirmed by reading STEP 1's own work) —
so it is naturally compatible with this constraint. This should be stated
as a design invariant in whatever executes this plan, not assumed silently:
**no future Python-side enrichment step may introduce a non-enterprise LLM
call against competitive signal data**, matching the precedent this
codebase already enforced once.

---

## 3. FactAnswer-to-table mapping, gap by gap

The Python pipeline (post-STEP-1) produces `FactAnswer` objects —
`entity_name, fact_type, fact_category, outcome, value, citation
(source_id, locator, retrieved_or_published_date), verification_status,
conflicting_citations, absence_semantics_applied, notes` — via
`pipeline.run_entity()`, plus (new as of STEP 1)
`truth_resolution.resolve_current_state()`/`group_and_resolve()` for
current-vs-historical state, and `deduplication.fact_identity()` +
`run_history.write_run_snapshot()` for the not-yet-consumed change-detection
substrate. `fact_type` vocabulary today: `trial_status`, `enrollment`,
`primary_outcome_definition`, `primary_outcome_result`, `current_phase`
(clinicaltrials_gov); `approval_status`, `approval_history` (fda);
`chmp_opinion_status`, `approval_status` (ema); `sec_filer_status_determined`,
`sec_disclosure_events` (sec); `official_disclosure_events` (official
company sources); `freshest_efficacy_safety_data` (pubmed);
`licensure_sponsor` (identity, cross-source derived). Congress
(`congress_mgfa`) produces **candidate_evidence only, deliberately not a
FactAnswer** — see below.

No genuine 1:1 mapping exists anywhere in this table. Every row below states
what kind of gap it is, not just that one exists.

| TS table | Mapping | What's actually needed |
|---|---|---|
| **`trials`** | **Needs transformation.** `trial_status`/`enrollment`/`primary_outcome_definition`/`primary_outcome_result`/`current_phase` are 5 separate `FactAnswer`s per trial in Python; `trials` is one row per `nct_id` with dedicated columns. | A reassembly layer that folds 5 fact_types sharing one `citation.locator` (the NCT ID) back into one row. `company_id` (competitor slug) has no Python equivalent — Python's `identity.CanonicalEntity` doesn't carry an ownership slug system. `raw_json` (full CT.gov API response) is not preserved by the adapter today — it normalizes into a dict, not a full-fidelity archive. |
| **`regulatory_events`** | **Needs transformation.** `approval_status`/`approval_history` (FDA) and `chmp_opinion_status`/`approval_status` (EMA) map to `event_type`/`date`/`authority` reasonably (`citation.source_id` → `authority`, `citation.retrieved_or_published_date` → `date`), but `headline`/`details` are prose the TS ingest scripts synthesize from structured filing data — Python's `FactAnswer.value` is a structured dict, not display prose. A presentation/formatting layer is needed; none exists on the Python side today. | 
| **`financial_snapshots`** | **No correspondence.** TS extracts XBRL revenue/R&D figures from 10-K/10-Q filings. Python's `sec_filings.py` extracts 8-K **event** disclosures only — `extraction.py`'s own docstring states structured 10-K/10-Q/6-K/20-F extraction "is not yet built." This needs a wholly new Python extraction path, not wiring. |
| **`regulatory_calendar`** | **No correspondence.** EMA CHMP/PRAC/etc. committee-meeting calendar feed. Python's `ema_chain.py` resolves one medicine's terminal EPAR link, not a general meeting calendar. No adapter produces this shape at all. |
| **`company_signals`** | **Partial, needs new classification logic per `signal_type`.** This is the largest, richest table and the main interop surface — see the vocabulary breakdown below. |
| **`company_summaries`** | **No correspondence, and explicitly out of scope for V1** — a rolling AI-narrative summary. `V1_SCOPE_AND_EVIDENCE_CONTRACT.md`'s own "DO NOT IMPLEMENT" list excludes generated insights/narrative from V1. |
| **`market_intelligence`** | **No correspondence, and out of scope for either side's automated pipeline.** This table is hand-edited directly via the Supabase dashboard (its own SQL file comment: "Rows are managed via the Supabase dashboard") — not populated by TS ingest scripts or by anything Python would replace. |
| **`documents`** | **Needs new capability.** TS stores full document text (`full_text`, capped 200k chars). Python's `SourceExecution.documents_retrieved` stores retrieved **URLs** only — no full-text archive exists anywhere in the pipeline today. |
| **`asset_lexicon`** | **Structurally different, not a clean map.** Roughly corresponds to Python's `identity.CANONICAL_ENTITIES` (hand-verified, static dict) + `indication_scope`'s registry combined — but `asset_lexicon` has a **live, user-facing write path** (ChEMBL-autocomplete onboarding upserts, anon-key browser writes, §2.1). Python's identity model has no live-write mechanism and no ChEMBL integration at all; this is a product behavior with no pipeline-side equivalent to swap in. |
| **`user_profiles` / `watched_assets` / `read_alerts`** | **No correspondence, correctly.** Per-user product state, RLS-protected on `auth.uid()`. Entirely orthogonal to an evidence pipeline — nothing about these three tables should change under this replacement regardless of which system writes competitor evidence. |
| **`messaging_snapshots`** | **No correspondence.** No adapter for company-website/messaging-copy scraping exists in the Python pipeline. |
| **`hta_decisions`** | **No correspondence — the single largest, best-evidenced gap.** `V1_SCOPE_AND_EVIDENCE_CONTRACT.md` §10 already documents "No V1 exposure" for HTA, confirmed unchanged by STEP 1. The TS side, by contrast, has real, structured, LLM-schema-extracted HTA coverage across 5 agencies (NICE live via Edge Function; EMA/G-BA/HAS/AIFA via Firecrawl) — see §5. |
| **`personnel`** | **No correspondence.** No executive-officer/DEF-14A adapter exists in Python. |
| **`pending_ownership_review`, `unresolved_trials`** | **No correspondence.** TS-pipeline-specific ownership-resolution bookkeeping/QA queues; Python's `identity.py` resolves ownership differently (static `CANONICAL_ENTITIES`, no unresolved-review queue concept). |
| **`ingest_runs`, `ingest_errors`** | **Conceptually close, not yet wired.** Roughly what Python's `SourceExecution`/`compute_job_rollup()` already track in memory per-run, and specifically what STEP 1's Part E substrate (`run_history.write_run_snapshot()`) is meant to eventually feed — but nothing in Python persists this today. This is one of STEP 1's own documented "remaining V1 blockers": the substrate exists, nothing writes to it yet. |

**`company_signals.signal_type` vocabulary, mapped individually** (16 values,
per `docs/ARIYA_LIGHT_IMPLEMENTATION_PROMPTS.md`'s canonical vocab table):

| `signal_type` | Python correspondence |
|---|---|
| `deal`, `exec_change`, `press_release` | Loosely: Python's `sec_disclosure_events` fact_type (from 8-K item-coded filings). But Python doesn't classify *which kind* of disclosure a filing represents — that item-code-based classification (`1.01`/`2.01` → deal, `5.02` → exec_change, `8.01` → press_release) exists only in the TS ingest layer today and would need to be built into the Python side, not just wired through. |
| `publication` | Cleanly: `freshest_efficacy_safety_data` (pubmed_eutilities). |
| `congress_abstract` | **Genuine model mismatch, not a gap to fill mechanically.** Python's `congress_mgfa` adapter deliberately produces `candidate_evidence` — an explicitly lower-confidence structure attached to `EntityRun`, never converted into a `FactAnswer` (confirmed directly in `pipeline.py`: "Candidates are NOT converted into FactAnswer here... a whole-document alias hit is not a graded efficacy/safety fact"). TS's `congress_abstract` signal_type is a full graded signal. Whether `candidate_evidence` should ever become a `company_signals` row — and with what confidence framing if so — is a real product decision, not a technical mapping. |
| `hta_decision` | **No correspondence at all** — see table above. |
| `regulatory_catalyst`, `label_update` | Roughly `approval_status`/`approval_history` from FDA/EMA, same headline-generation gap as `regulatory_events` above. |
| `messaging_shift` | No correspondence — no messaging adapter in Python. |
| `earnings`, `ir_rss` | No correspondence — no earnings/IR-feed adapter in Python. |
| `trial_status_change`, `trial_update` | Python's `trial_status` fact_type carries the **current** state per trial. The TS concept of *a change was detected between two runs* is exactly what STEP 1's Part E substrate (`fact_identity()` + `write_run_snapshot()`) exists to eventually support — but the actual diff/comparison logic is explicitly deferred to V2 (STEP 1's own §16), not built yet. |
| `exclusivity_listing`, `patent_grant`, `ip_litigation` | No correspondence — no patent/IP adapter in Python at all. |

**Columns on `company_signals` with no `FactAnswer` equivalent:**
`is_illustrative` (a TS-only data-quality badge), `why_it_matters`
(interpretive text — explicitly excluded from V1 per
`V1_SCOPE_AND_EVIDENCE_CONTRACT.md`'s "DO NOT IMPLEMENT" list), `severity`
(a TS-only deterministic triage classification with no Python-side
equivalent notion).

**The reverse gap, stated explicitly since the prompt asked for genuine gaps
both ways:** Python's `EvidenceProfile` (`identity_confirmed`,
`indication_confirmed`, `category_results`, `limitations`) and
`verification_status`/`conflicting_citations` (a real confidence/conflict
gradient per fact) have **no TS-side surface at all**. Every
`company_signals` row is presented today with equal confidence — there is
no product surface for "this evidence is currently insufficient for
comparison" or "this fact is contested between two sources." Whether the
replacement backend exposes this richer Python-side model to the UI, or
collapses it down into the current flat TS schema, is an open product
decision, not resolved here.

---

## 4. Disease/asset-scope question — open, not resolved here

Ariya Signals currently tracks **HAE, PNH, and PBC only** — a hardcoded
7-INN list in `src/config/assets-config.ts` (3 trackable assets: sebetralstat/
HAE, iptacopan/PNH, seladelpar/PBC; 4 competitor-product entries, all HAE:
lanadelumab, berotralstat, deucrictibant, navenibart), confirmed directly
against the file. Onboarding's ChEMBL autocomplete is explicitly constrained
to "drugs within already-curated indications" (`ARIYA_LIGHT_IMPLEMENTATION_PROMPTS.md`'s
own locked decision) — i.e. the product cannot today onboard a user into a
disease outside HAE/PNH/PBC even via the live autocomplete path.

The Python pipeline is **gMG-first** (its only real, hand-verified seed data
is 4 gMG brands: VYVGART, VYVGART HYTRULO, RYSTIGGO, IMVT-1402) and, as of
STEP 1, is **architecturally multi-disease-capable** — `indication_scope.py`'s
registry can hold a second or third disease's synonym set, and no reusable
pipeline code branches on disease identity. But architectural capability is
not the same as real product data: STEP 1 explicitly did not invent
psoriasis or third-disease assets, per its own instructions.

**The open question, named explicitly, not defaulted:** does swapping the
ingestion mechanism also mean expanding Ariya Signals' real tracked disease
scope to include gMG (and whatever real assets that would require —
VYVGART/RYSTIGGO/etc. as trackable products, new `ASSETS_CONFIG` entries,
new onboarding copy, new competitor context)? Or does the product stay
HAE/PNH/PBC-scoped, with the ingestion mechanism swapped underneath while
the actual tracked assets are unchanged — meaning the Python pipeline would
need real HAE/PNH/PBC seed data built (the 7 INNs above, their trials,
approvals, EMA/FDA records — none of which exist in the Python pipeline's
`CANONICAL_ENTITIES` today) before it could replace the TS ingestion for
*this specific product* at all?

This is a real product decision with real scoping consequences either way,
not a technical detail — it is being surfaced here, not answered.

---

## 5. HTA/Congress prior-art assessment

### HTA — real, structured domain knowledge worth porting

**`supabase/functions/ingest-hta` (NICE, UK):** a live, mature, structured
integration. Queries NICE's internal search API
(`search-api.nice.org.uk/api/search?index=guidance`) per drug INN, filters
to `"Technology appraisal guidance"` only (excludes drafts/consultations —
`guidanceRef` null-check), derives `decision_type` from title text
(`"not recommended"` string match, defaults to `recommended`), writes to a
dedicated `hta_decisions` table **and** `company_signals`
(`signal_type='hta_decision'`), with SHA-256 dedup on `source_hash`,
timestamped `ingest_runs` audit logging, and a documented lookback-window
override for historical backfill. This is graded structured extraction, not
raw text capture — genuinely worth porting into a future Python HTA adapter:
the specific API endpoint, the guidance-type filter, and the
draft-vs-published distinction are all real, hard-won domain knowledge.

**`scripts/ingest-eu-hta-firecrawl.mjs` (EMA/G-BA/HAS/AIFA):** also
structured, via Firecrawl's LLM-guided JSON extraction against a hand-built
per-agency schema (EMA: `drug_name`/`active_substance`/`authorization_date`/
`status`/`indication`/`mah`; G-BA/HAS/AIFA: an array of
`title`/`date`/`outcome`/`indication`/`url`/`summary` decisions), with
explicit anti-hallucination checks (extracted titles must appear literally
in the scraped markdown; EMA pages additionally require the drug's INN to
appear). Domain knowledge worth porting: the exact EPAR/G-BA/HAS/AIFA target
URLs for the product's real drug registry, the documented per-agency date-
format quirks (AIFA `DD/MM/YYYY`, HAS French month names), and the
explicit note that free-source list-price data does not exist for
hospital-dispensed specialty drugs from any public source — a real,
previously-learned negative finding, not just a positive one.

**Maturity verdict:** both are **structured, graded extraction**, not raw
text capture — meaningfully more mature than the Python pipeline's current
HTA coverage, which is zero. This is confirmed as the single largest,
most concretely portable gap identified in this whole recon.

### Congress — two implementations, one explicitly superseding the other

**`scripts/ingest-congress-abstract.mjs`:** the older approach — downloads a
congress abstract-book PDF, splits it into blocks via regex on abstract-
number patterns (`P001`, `OA-23`, etc.), applies a keyword-based relevance
gate and a keyword-based severity heuristic (`isPhase3 && hasOutcome`).
This is **raw/heuristic text extraction**, not structured/graded facts — the
same maturity level as the Python pipeline's own current congress coverage
(`congress_mgfa` producing ungraded `candidate_evidence`, never a
`FactAnswer`).

**`scripts/ingest-congress-firecrawl.mjs`:** explicitly documented in its
own header as **replacing** the above ("Replaces
`ingest-congress-abstract.mjs` (DIY pdf-parse + regex approach)"), using
Firecrawl's LLM-guided JSON extraction instead — no regex splitting, no PDF
download, works against both HTML supplement pages and web-hosted PDFs, with
pagination support. This is the more mature, current implementation; the
regex-based one is legacy and the newer file's own comment includes cleanup
SQL to delete its test rows.

**Maturity verdict and portability:** the Firecrawl-based congress ingest is
worth porting as domain knowledge (its abstract-detection prompt shape, its
pagination-until-empty stopping condition) once Python's own congress
extraction moves past `candidate_evidence` toward graded facts — which,
per `V1_SCOPE_AND_EVIDENCE_CONTRACT.md` and STEP 1's own report, remains
explicitly out of scope until Prompt 4/V2.

---

## 6. Proposed phased execution sequence (not executed here)

Proposed only, mirroring this repo's own `ARIYA_LIGHT_IMPLEMENTATION_PROMPTS.md`
phase-gate convention — one phase pasted at a time, each with its own Verify
gate and STOP condition, each its own revertible commit, no phase starts
until the previous one's gate is green and reviewed.

**Phase 0 — Baseline & schema ground-truth (no code changes).**
Resolve the two open questions from §1 and §4 above with the user. Dump the
actual live Supabase Cloud schema (`pg_dump --schema-only` /
`supabase db dump`) and diff it against every tracked `.sql` file in this
repo, producing a definitive, corrected schema reference — §2.3's four
confirmed gaps are a floor, not a ceiling; a real dump may surface more.
**Verify gate:** the dumped schema and this repo's own `.sql` files are
reconciled into one document; every live table/column/RLS policy is
accounted for, not just the ones already found in this pass.

**Phase 1 — Self-hosted stack stood up, empty, alongside production.**
Stand up Supabase's reference Docker Compose stack against the user's bare
Postgres instance per §1's concrete steps. Apply the corrected schema from
Phase 0. No traffic cut over yet — this runs in parallel with the live
Supabase Cloud project, verified independently (auth flow, RLS policies,
anon/service-role grants all match) before anything reads or writes real
data. **Verify gate:** a test row written via the service-role key is
readable via the anon key exactly as it is in production, for one table
from each access tier in §2.2.

**Phase 2 — Python pipeline writes to the self-hosted stack, one table,
schema-only, no cutover.** Wire `pipeline.run_entity()`'s output through
`output_contract.to_contract_v0_1()` into a real Postgres writer (new,
`psycopg2`/`asyncpg`/SQLAlchemy — not built yet), targeting the
**best-mapped** table from §3 first (`trials`, since 5 of Python's fact_types
already map onto it with the least invention required) against the
self-hosted instance only. Frontend continues reading production Cloud;
this is purely a write-path proof. **Verify gate:** a real Python-pipeline
run for a real tracked asset produces rows in the self-hosted `trials` table
that `src/lib/db/index.ts`'s existing query shape can read without any
frontend change.

**Phase 3 — Resolve the scope question from §4 before going further.**
Everything past this point depends on whether the tracked-asset scope is
HAE/PNH/PBC-as-is or expands to include gMG — building real seed data for
the wrong scope is wasted, invented-data-risk work. **Hard stop until §4 is
answered**, not a technical gate.

**Phase 4 — Table-by-table migration, one at a time, each verified against
the live frontend before the next.** In the order §3's gap analysis
suggests as cheapest-to-safest: `trials` → `regulatory_events` (needs the
new headline/prose layer) → `company_signals`'s cleanly-mapped signal_types
(`publication`, then `deal`/`exec_change`/`press_release` once the
item-code classifier is ported) → everything else in §3, gap by gap, with
`hta_decisions`/`financial_snapshots`/`messaging_snapshots`/`personnel`
last since each needs an entirely new Python-side extraction capability
that doesn't exist yet, not just a write-path change. **Verify gate per
table:** the self-hosted write and the production Cloud read produce
byte-identical frontend output for a fixed set of test competitors, before
that table's TS ingest scripts are retired.

**Phase 5 — Cutover.** Point production `VITE_SUPABASE_URL`/
`VITE_SUPABASE_ANON_KEY` at the self-hosted stack. Retire the ~49 TS/
Firecrawl ingest scripts and 5 Edge Functions/4 Vercel API ingest routes
only after their corresponding table has passed Phase 4's gate — not en
masse. **Verify gate:** full frontend smoke test against the self-hosted
stack in production, old Supabase Cloud project kept read-only and
un-deleted for a rollback window.

**Phase 6 — Full-system robustness sweep (final),** same spirit as this
repo's own existing Phase 6: confirm no dangling references to the retired
ingest scripts, confirm `schema.sql`'s stale definitions are either deleted
or explicitly marked historical so they can never again be mistaken for
ground truth, confirm the §2.3 undocumented-drift objects are now properly
tracked as real migrations against the new self-hosted schema.

---

## 7. Build/lint/test baseline — exactly as measured

**Ariya-Signals (this repo), clean checkout, this session:**

```
$ npm install
added 269 packages, and audited 270 packages in 14s
9 vulnerabilities (1 low, 1 moderate, 7 high)   # pre-existing, not investigated this pass

$ npm run build      # vite build only, no typecheck (per CLAUDE.md)
✓ 2286 modules transformed, built in 5.31s      # GREEN

$ npm run lint
Oops! Something went wrong! :(
ESLint: 9.39.4
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

**`npm run lint` is red on a clean checkout — confirmed a genuine,
structural gap, not a transient failure.** `git log --all` for
`eslint.config.{js,mjs,cjs}` / `.eslintrc*` at the repo root returns zero
history — a config file was never committed at the root. The only
`eslint.config.js` in this checkout lives inside `ariya-signals-main/`,
which `ARIYA_LIGHT_IMPLEMENTATION_PROMPTS.md`'s own global guardrails
explicitly mark **stale — never read or edit it**. Per that same document's
own Phase 0 precedent ("If `npm run build` or `npm run lint` is already red
on a clean checkout, STOP and report exactly what fails. We fix the
baseline before building anything new"), this is flagged here rather than
worked around — **fixing this (adding a real root `eslint.config.js`) is
its own separate, small, pre-existing-baseline task, not part of this
backend-replacement plan**, but it should be fixed before Phase 1 above
starts, so future phases have a real lint gate to hold to.

```
$ npm run typecheck   # tsc -b, all three project references
207 errors                                       # measured, not estimated
```

`CLAUDE.md` states a baseline of "~335 pre-existing errors" — the measured
count here (207) is lower. Not investigated further in this pass (out of
scope for a recon-only prompt); noted as a discrepancy between documented
and measured baseline, same category of finding as `SYSTEM_STATE.md`'s
staleness elsewhere in this document. `npm run build` itself does not
typecheck (Vite/OXC only, per `CLAUDE.md`), so this number does not block
`build`.

**ariya-lightci-python (the finished STEP 1 pipeline), fresh process, this
session:**

```
$ python3 -m pytest -q
400 passed in ~29-33s
```

Confirmed green, matching STEP 1's own final report exactly (364 baseline +
36 new tests from STEP 1 = 400).

**Overall Setup-gate verdict:** Python pipeline is fully green. Ariya-Signals
`build` is green; `lint` is red for a structural, pre-existing, repo-root-
config reason unrelated to any code path this plan touches. Per this
recon prompt's own instruction ("If either is already red on a clean
checkout, STOP and report before doing anything else"), this is reported
here rather than silently worked around or fixed as a side effect of this
recon.
