# Orientation — continuing Ariya Light CI on a new machine (paste this as your first message)

> **⚠️ SUPERSEDED (2026-09-08) — read `ariya-lightci-python/HANDOFF.md` instead, don't paste this file.**
> This is a stray copy of `ariya-lightci-python`'s own `ORIENTATION_PROMPT.md`,
> left in this (unrelated) repo's root from an old zip-based handoff. It is
> stale as of that repo's commit `237de53` (see its HANDOFF.md for exactly
> what it gets wrong). Kept below only for its still-useful historical
> narrative of threads #1-4 (the V1 evidence pipeline).

## Setup

**If you got here via a git clone** (the normal path for Claude Code's web app — this repo is
`github.com/Ayat-T523/ariya-lightci-python`, private, created 2026-08-19 by pushing what used to
be a zip-only handoff artifact): you're already sitting on everything you need. Just confirm
`python3 -m pytest -q` reports **1511 passed, 8 warnings** (install `jsonschema>=4.0` first if
collection fails — it's a declared dependency, not a new gap; the 8 warnings are a pre-existing,
unrelated `bs4.XMLParsedAsHTMLWarning` in `adapters/sec_filings.py`). This repo has exactly one
commit on `main` as of 2026-08-19 — everything in it is the same 1511-passing checkpoint this
file describes throughout.

**If you got here via the older zip-based handoff instead** (CLI Claude Code, `NEW_MACHINE_START_HERE.md`):
you're working in `~/ariya-work/ariya-lightci-python/`, already unzipped from
`ariya_lightci_v1_population_evidence_foundation_20260819_1511green.zip`, which sits one
directory up, alongside its `.sha256`, `../MANIFEST_sha256_population_evidence.txt`, and
`../BASELINE_pytest_report_population_evidence.txt`. Verify the unzip against the manifest
before doing anything else (see `NEW_MACHINE_START_HERE.md` for the exact commands), then run
the same `python3 -m pytest -q` check above.

A sibling clone of the real product repo, `Ariya-Signals` (github.com/Ayat-T523/Ariya-Signals),
may also be present if a prior session set it up — only needed if you're picking up
backend-replacement work specifically (see "What's NOT done" below). **Naming gotcha**: that
repo has an unrelated branch called `ariya-light-inn-persistence` — a feature of the real
product, nothing to do with this Python prototype. Same "Ariya Light" name, two different
things — see `NEW_MACHINE_START_HERE.md` §0 if this comes up.

## What this project is

**Ariya Light CI** — a competitive-intelligence evidence pipeline, originally built for gMG
(generalized myasthenia gravis) and, as of a recent pass, made structurally disease-agnostic.
It resolves a tracked pharma brand's identity, pulls evidence from real source adapters
(ClinicalTrials.gov, FDA, EMA, SEC/EDGAR, company IR pages, PubMed, an MGFA congress abstract
book, and — newest — four HTA bodies), extracts normalized `FactAnswer` claims with real
citations, validates/deduplicates/attributes them, and serializes everything through a frozen
output contract (`ARIYA_CI_OUTPUT_CONTRACT_V0.1.md` / `output_contract.py`) that a downstream
app is meant to consume without ever touching internal pipeline shapes directly.

The whole project has one non-negotiable discipline, stated over and over in its own code
comments and status docs, and you should hold it just as tightly: **never fabricate evidence,
never present an unresolved state as a resolved one, never claim validation that didn't happen.**
Every "we don't know" stays visible as an honest gap (a specific `SourceRunState`, a
`verification_status`, an explicit doc section) rather than being smoothed over.

## What's already done, in order — do NOT redo any of this

### 1. Original vertical-slice build (Runs 1-4, various dates before this pass sequence)
Seven real source adapters (`adapters/clinicaltrials_gov.py`, `fda_drugs_at_fda.py`,
`ema_chain.py`, `sec_filings.py` + `sec_bootstrap.py`, `official_company.py`, `pubmed.py`,
`congress.py`), each with a REPLAY (fixture-based) and, for most, a LIVE (real network fetch)
path. Four real gMG brands seeded in `fixtures/merged.py`'s `CANONICAL_ENTITIES`: **VYVGART**
(efgartigimod alfa, argenx), **RYSTIGGO** (rozanolixizumab, UCB), **ZILBRYSQ** (zilucoplan, UCB),
**IMVT-1402** (batoclimab, Immunovant — investigational, no INN yet). `V1_SCOPE_AND_EVIDENCE_CONTRACT.md`
is the living spec of what V1 does and doesn't promise; read its top status block for the
current authoritative summary before reading anything else in it.

### 2. V1 multi-disease/state-foundation pass (2026-08-13)
Removed hardcoded gMG defaults from reusable pipeline code (`indication_scope.py`'s
`_DISEASE_REGISTRY`/`register_disease()`/`DEFAULT_INDICATION` replaced 7 duplicated magic
strings). `identity.CanonicalEntity` deliberately still has NO indication field — documented
decision (IMVT-1402 spans multiple real indications; indication stays a `pipeline.run_entity()`
run-level parameter, not asset identity). Added `deduplication.fact_identity()` (public, stable,
sha256-based — wraps the still-private `_fact_fingerprint()`) and `run_history.py`
(`write_run_snapshot()`, opt-in, not wired into the pipeline automatically) as the minimum
substrate a future V2 change-detection layer would need. Added `truth_resolution.resolve_current_state()`/
`group_and_resolve()` for current-vs-historical-vs-conflicting fact resolution (deliberately no
"newer always wins" rule). Full writeup: `V1_MULTIDISEASE_STATE_FOUNDATION.md`.

### 3. V1 Congress+HTA hardening pass (2026-08-14, "Prompt 4")
**Congress** (`adapters/congress.py`, `extraction.congress_facts()`): previously status-only (a
Phase 2 correction pass had removed an earlier, buggy fact-extraction path that fabricated
facts from bare whole-document alias hits). Rebuilt correctly: a candidate is only promoted to a
real `FactAnswer` when a NEW structural parser (`_split_page_into_abstracts()`, validated
against a real captured MGFA excerpt at
`fixtures/live_samples/congress_mgfa_2025_abstract_excerpt.txt`) confirms it falls inside a
real, structurally-detected abstract with a genuine RESULTS/SUMMARY section — never a bare
substring hit. Reuses the existing `freshest_efficacy_safety_data` fact_type; no new type
needed. Directly tested against a real multi-asset abstract to prove retrieval context alone
never determines attribution.

**HTA framework built from zero** (`adapters/hta_base.py` + `hta_eu_jca.py`/`hta_gba.py`/
`hta_has.py`/`hta_aifa.py`): shared applicability registry + failure-state mapping, one real
adapter module per body (deliberately not one shared parser — the four bodies' real formats
differ). At the END of this pass, every KNOWN_*_SOURCES dict was still empty and every source
resolved (incorrectly, see next pass) `NOT_APPLICABLE`.

### 4. HTA evidence-readiness closure pass (2026-08-14, same day, immediately following #3)
**This is the most recent work — read `V1_CONGRESS_HTA_READINESS.md` §14 for the full detail.**

- **Fixed a real applicability-model bug (Part B):** `unseeded_execution()` was returning
  `NOT_APPLICABLE` for "no identifier configured yet" — conflating "undetermined" with
  "genuinely doesn't apply." Now returns `NOT_STARTED`, matching the exact precedent
  `adapters/official_company.py` already established for the same situation. No new
  `SourceRunState` was added.
- **Real recon changed the picture (Part A):** WebSearch (NOT direct WebFetch — that's
  confirmed BLOCKED to g-ba.de/has-sante.fr/aifa.gov.it/the EU HTA portal in every environment
  this project has run in, three independent confirmations now) located real, indexed,
  search-confirmed identifiers on each body's own domain for the three real gMG brands:
  - **G-BA** (Germany): real procedure IDs 871/1063/1064, dossier IDs D-858/D-1042/A24-26,
    real decision dates, real Zusatznutzen (added-benefit) findings — seeded in
    `adapters/hta_gba.py`'s `KNOWN_GBA_SOURCES` / `KNOWN_GBA_SOURCES_PROVENANCE`.
  - **HAS** (France): real `CT-#####` avis document IDs, real ASMR IV rating for VYVGART
    confirmed — seeded in `adapters/hta_has.py`.
  - **AIFA** (Italy): real Determina numbers (454/2023, 652/2025), real Gazzetta Ufficiale
    publication dates — seeded in `adapters/hta_aifa.py`.
  - **EU JCA stays unseeded for a DIFFERENT, non-configuration reason:** all three real gMG
    brands are orphan-designated; the EU JCA framework doesn't cover orphan drugs until ~2028
    (it started Jan 2025 for oncology/ATMPs only). `hta_eu_jca` was REMOVED from gMG's
    applicable-source registry (`hta_base._HTA_APPLICABILITY_REGISTRY`) — a real jurisdictional
    finding, not an identifier gap.
  - **Explicit, important caveat, do not lose this distinction:** these are real,
    search-indexed URLs, confirmed as real locations on each body's own domain — NOT confirmed
    by reading their actual content (WebFetch to all of them: `EGRESS_BLOCKED`). This is a
    genuinely weaker provenance tier than "hand-confirmed real" elsewhere in this codebase
    (Congress's MGFA excerpt, `official_company.py`'s IR URLs). No `FactAnswer` was ever built
    from a search snippet's content.
- **New fact_type, justified by the real recon (Part D, revisiting the prior pass's deferral):**
  `hta_benefit_assessment` (`body` + `determination` + `assessed_population`, all required;
  `determination` deliberately free-text, not one shared enum — G-BA's Zusatznutzen categories,
  HAS's ASMR grades, and AIFA's reimbursement classes are genuinely different real scales).
  14th entry in `extraction.REQUIRED_FIELD_VALIDATORS` (was 13).
- **Real parsers, real fact extraction, still content-unvalidated:** `_parse_gba_page()`/
  `_parse_has_page()`/`_parse_aifa_page()` now target each body's real, standardized public
  vocabulary (not a stub returning `[]` unconditionally anymore) — but are UNVALIDATED against
  any real captured document (none exists in this repo; none could be retrieved this session).
  `extraction.hta_facts()` is real now (was a `NotImplementedError` tripwire) and IS called by
  `pipeline.py` — every fact it would build is marked `verification_status="partially_verified"`.
  In every actual run this pass, it still produces **zero** real facts: every real, seeded
  live-fetch attempt for G-BA/HAS/AIFA genuinely resolves `SOURCE_UNAVAILABLE` (blocked egress),
  before any parsing is ever reached.
- **Test suite:** `tests/test_hta_framework.py` substantially rewritten (55 tests). Full suite:
  **472 passed**, confirmed twice, fresh process each time.
- **Explicit Part G blocker answers (do not re-derive these, they're already answered):**
  1. Can V1 truthfully claim HTA factual source support today? **No.**
  2. What's missing? **Real network egress** to g-ba.de/has-sante.fr/aifa.gov.it (or any other
     legitimate way to retrieve the real document content behind the 9 already-identified real
     URLs). Nothing else — not an identifier, not a fact_type, not attribution/dedup/
     serialization.
  3. Can that be closed without redesigning the architecture? **Yes, entirely** — the moment
     real content is retrievable, the existing parsers/extraction/validation/output path is
     already real and already wired; it would just start producing real, verified facts.
  4. Engineering vs. product/scoping work? G-BA/HAS/AIFA: **zero remaining engineering work**
     to reach "evidence flowing" (pure environment/access constraint). EU JCA: **zero
     engineering work possible or needed** — pure regulatory-scope timing (the regulation's own
     phase-in schedule), not something more engineering effort changes.
  5. Does this block V1 under the current roadmap? **Deliberately not answered** — the roadmap
     itself was explicitly not to be touched by that pass. This is a real open decision point
     for whoever owns the roadmap (you, or whoever you're relaying this to) — it was not made
     for you.

### 5. Relationship-classification STEP 2 → STEP 3B.1 (2026-08-19) — competitor-population-evidence foundation

A new, separate workstream from #1-4 above: **DIRECT / INDIRECT / UNCLEAR competitor
relationship classification** for a home asset (RYSTIGGO/ZILBRYSQ) vs. a discovered candidate
(CABA-201, nipocalimab/IMAAVY, efgartigimod/VYVGART, gefurulimab, imeroprubart, claseprubart,
povetacicept, remibrutinib, iptacopan, cell therapies, MuSK-specific approaches). **No
classification code exists yet** — every pass so far has been investigation + one narrow,
evidence-gated implementation. Read in this order if you're continuing this thread:

- **STEP 2** (repository investigation, no code): traced the discovery pipeline
  (`discovery_landscape.discover_landscape()` → STEP4-11 → `DiscoveryCandidateReconciliation`
  with `status: PresentationReadinessStatus`) and confirmed the module's own docstring already
  states it must NOT classify Direct/Indirect/Unclear — i.e. this is the anticipated, intended
  seam, not a gap to invent. Found this is a SEPARATE pipeline from #1 above (`pipeline.run_entity()`
  is the named-asset `FactAnswer` pipeline; the two are not wired together — `pipeline.run_entity()`
  cannot run ephemerally on a freshly-discovered, non-canonical candidate today; `identity.
  resolve_entity_identity()` raises `LookupError` for anything outside `CANONICAL_ENTITIES`).
- **STEP 3** (evidence sufficiency investigation, no code): verdict was **NOT READY** — no
  trusted source establishes a competitor asset's eligible patient population in a form
  comparable to the home asset's own G-BA population evidence (`hta_benefit_assessment
  .value.assessed_population`, real for RYSTIGGO's AChR+/MuSK+ split). Found `adapters/
  clinicaltrials_gov.py` fetches the full CT.gov v2 record but never reads
  `eligibilityModule` (eligibility criteria/age/sex) — AVAILABLE UPSTREAM, CURRENTLY DROPPED.
  G-BA's own real comparator text (e.g. efgartigimod named as a comparator in ZILBRYSQ's own
  document) exists but is used only defensively, never promoted to a structured claim.
- **STEP 3B** (implementation, closing ONE narrow blocker): added `eligibility_criteria`/
  `minimum_age`/`maximum_age`/`sex` to `RawInterventionObservation` (`adapters/
  clinicaltrials_gov.py`), and a new module `discovery_population_evidence.py` —
  deterministic, explicit-marker (AChR/MuSK only — no other marker family; "seronegative" was
  investigated and excluded, zero real evidence for it anywhere) extraction from eligibility
  text, with `PopulationDirection` (INCLUDED/EXCLUDED/MENTIONED_UNRESOLVED) derived from which
  literal CT.gov section header ("Inclusion Criteria:"/"Exclusion Criteria:") the mention falls
  under — deliberately NOT a negation-language/semantic parser. Every observation is scoped to
  one `(nct_id, intervention_name)` pair; `group_population_observations_by_marker()` is a
  diagnostic-only grouping helper that never resolves disagreement across studies — no
  program-level population claim is ever produced. 13 new tests, TDD (red→green each one).
- **STEP 3B.1** (real-world validation against LIVE ClinicalTrials.gov, not just fixtures): ran
  `discover_by_indication("generalized myasthenia gravis", mode="live")` for real — 200 raw
  observations across 111 real studies — then grouped via the existing `discovery_identity
  .resolve_discovery_identities()` to find real records for CABA-201, nipocalimab, gefurulimab,
  claseprubart, povetacicept, remibrutinib, iptacopan, and efgartigimod (VYVGART's INN); found
  and fixed ONE real, narrow header-format gap (`"Inclusion (key)"`/`"Exclusion (key)"`, a real
  Ravulizumab record's own header style, not covered by the original `"...Criteria:"` pattern —
  fixed with a one-line regex extension + a regression test using the real text verbatim).
  `imeroprubart` has **no real gMG ClinicalTrials.gov record** in the live result set — reported
  honestly as not-found, never substituted with an unrelated trial.
  **Important documented limitation, NOT a code defect** (do not "fix" this without re-reading
  why): `PopulationDirection` reflects which CT.gov section a marker mention falls under, NOT
  serologic test-result polarity. A seronegative-focused trial (real example found live:
  ARGX-113/efgartigimod's NCT06587867) states "negative serologic test for anti-AChR and
  anti-MuSK antibodies" INSIDE its Inclusion Criteria section — this correctly reports `AChR:
  INCLUDED` / `MuSK: INCLUDED` per the field's own definition (found in the Inclusion section),
  which is easy to misread as "this trial enrolls antibody-positive patients" if you don't also
  read `evidence_text`. Fixing this would require parsing positive/negative language next to the
  marker — explicitly out of scope for this gate ("deterministic explicit-marker recognition
  only," no semantic/negation interpretation). Any future consumer of `StudyPopulationObservation`
  MUST read `evidence_text`, not just `marker`/`direction`, before treating it as a population
  claim.
  **Files this added/changed**, all in `ariya-lightci-python/`: `adapters/clinicaltrials_gov.py`
  (4 new fields), `discovery_population_evidence.py` (new module), `tests/
  test_ctgov_eligibility_fields.py` (new), `tests/test_population_evidence.py` (new). Nothing
  else touched — no G-BA adapter change, no currentness/eligibility logic change, no canonical
  registry change.
  **Current verdict, do not re-derive**: `REAL COMPETITOR POPULATION VALIDATION PASSED` for the
  narrow population-evidence-foundation scope. Relationship classification itself remains
  **NOT READY** — G-BA comparator/treatment-decision evidence is the next, still-untouched
  blocker (STEP 3's Part F/G — treatment setting, line of therapy, and comparator evidence
  remain `NOT_AVAILABLE`/`NOT_CURRENTLY_EXTRACTED` everywhere). **The explicit instruction across
  every pass in this thread has been: do NOT start G-BA comparator work without a fresh,
  explicit go-ahead** — it has never been authorized, only investigated (STEP 3, Part J).

## What's NOT done (don't assume it happened)

- Congress remains bounded to its ONE seeded document (the 2025 MGFA abstract book) — no
  broader congress coverage exists.
- No HTA source has ever produced a real fact for any brand, in any pass — the framework is
  real; the evidence flowing through it is not, for the reason stated above.
- No automated, runnable "V1 Evidence Gate" exists yet (checking all 11 rules in
  `V1_SCOPE_AND_EVIDENCE_CONTRACT.md` §12 together with one pass/fail result) — still just a
  documented checklist, not code.
- No psoriasis or real third-V1-disease product/asset data exists anywhere — every
  disease-configurability proof in the test suite uses an obviously-fake, clearly-named
  test-only fixture (`__test_only_*_fixture`), registered temporarily and torn down after each
  test. If/when real psoriasis or third-disease product scoping arrives from the product side,
  it plugs into the SAME registries this work proved are genuinely configurable
  (`indication_scope.py`, `hta_base._HTA_APPLICABILITY_REGISTRY`) — no architecture change
  needed to receive it.
- Competitor comparison, alerts, badges, monitoring feeds, generated insights, and actionable
  follow-ups remain entirely untouched by every pass above — `comparison.py`/`evidence.py`
  exist and are explicitly NOT extended or consulted by any of this work (see
  `V1_SCOPE_AND_EVIDENCE_CONTRACT.md` §1's own scope boundary).
- Separately, a real product repo, `Ariya-Signals` (github.com/Ayat-T523/Ariya-Signals, a
  React/TS/Supabase app — see its own `CLAUDE.md`), had a RECON-ONLY pass done against it
  (`BACKEND_REPLACEMENT_PLAN.md`, pushed to branch `claude/ariya-lightci-two-step-eckocz`,
  commit `8bcb1d9`) — mapping how this Python pipeline's `FactAnswer` model could replace that
  app's current data layer. That plan surfaced open product questions (which real disease/asset
  set V1 actually ships with, Postgres hosting) that were never resolved — nothing from that
  plan has been implemented in either repo.
- **Relationship classification (DIRECT/INDIRECT/UNCLEAR) has NOT been implemented at all** —
  #5 above is investigation plus one narrow, evidence-gated foundation piece
  (competitor-side AChR/MuSK population evidence), not classification itself. No
  `RelationshipEvidenceView`/`CompetitorRelationshipRecommendation`-shaped type exists anywhere
  in the code — those were discussed as PROPOSED DESIGN in STEP 2's report, never built.
- **G-BA comparator/treatment-decision evidence extraction has NOT been started** — explicitly
  investigated (STEP 3, Part J: real comparator text exists in G-BA documents but is used only
  defensively) and explicitly NOT authorized to implement in every pass since. Do not start this
  without asking first, even though the population-evidence blocker (STEP 3's original reason
  for the NOT READY verdict) is now partially closed.
- No pairwise (home-asset vs. competitor) gold benchmark exists — `gmg_gold_benchmark.py`'s
  `GMG_GOLD_BENCHMARK` is flat, single-asset dispositions only (confirmed in STEP 2, Part M);
  building real relationship-classification gold cases is unstarted.

## Key files to read first, in this order, before doing anything

**If continuing #1-4 (V1 evidence pipeline / HTA):**
1. `V1_SCOPE_AND_EVIDENCE_CONTRACT.md` — top status block, then §13/§14 for the two most recent
   passes specifically.
2. `V1_CONGRESS_HTA_READINESS.md` — the full Congress+HTA accounting, including the six-way HTA
   readiness table (§ near the top) and §14's Part A-G closure detail.
3. `V1_MULTIDISEASE_STATE_FOUNDATION.md` — if you need the multi-disease architecture's own
   full reasoning.
4. `extraction.py`, `pipeline.py`, `adapters/hta_base.py` — if you're about to touch code, read
   these three first; almost everything else follows their existing conventions.

**If continuing #5 (relationship classification):**
1. `discovery_landscape.py`'s module docstring — the exact insertion-point contract STEP 2
   found; still accurate.
2. `discovery_population_evidence.py`'s module docstring — the full semantic boundary (study-
   level vs. program-level, marker vocabulary, direction semantics, the documented
   INCLUDED-vs-serologic-polarity limitation) is written there in detail; do not re-derive it.
3. `discovery_candidate_reconciliation.py` — `PresentationReadinessStatus`; only
   `PRESENTABLE_CANDIDATE` may ever enter relationship-evidence work, per every pass in this
   thread.
4. `tests/test_population_evidence.py` — the clearest worked examples of what the extraction
   does and does not claim.

There is no single written report file for STEP 2/STEP 3's full findings (A-O sections) — they
were produced and reviewed in chat, not saved to a file in this repo. If you need that level of
detail reconstructed, re-run the same investigation rather than assuming it's written down
somewhere; the summary in this file's own section 5 above is the compressed version.

## What to do next

Nothing has been decided about what comes after either thread. Do not assume a next task — the
natural open questions, in rough priority order, are:

**Thread #1-4 (V1 evidence pipeline):**
- Is real network/HTA-source access available in THIS environment? If so, that's the direct
  unblock for G-BA/HAS/AIFA (see §4's Part G above) — worth checking before anything else.
- Does the roadmap still call for HTA to be a V1-blocking capability, given the honest state
  above, or should it move to a later phase? (Explicitly not decided by any prior pass.)
- Is there appetite to revisit `BACKEND_REPLACEMENT_PLAN.md` and its open product questions
  (real disease/asset scope, Postgres hosting)?

**Thread #5 (relationship classification) — this package's own reason for existing:**
- Is there appetite to start G-BA comparator/treatment-decision evidence extraction now that the
  population-evidence blocker is partially closed? This has been investigated but explicitly
  never authorized to implement.
- Alternatively, is population evidence alone (AChR/MuSK) enough to attempt a first, narrow
  UNCLEAR-heavy classification pass, deferring comparator evidence to a later gate?
- Should real pairwise gold benchmark cases be constructed now (RYSTIGGO/ZILBRYSQ vs. each real
  candidate found live in STEP 3B.1) before any classification code is written?

Ask the user which of these (or something else entirely) before starting work.
