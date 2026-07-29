# Ariya Signals — Round 2 Prompts (post-War-Room-worklist)

**Date:** 27 July 2026 · **Branch:** `iteration-5` · Claude Code + Impeccable + InForm
**Grounded in:** the 27 Jul frontend status report + live DB reality (see `docs/hygiene-check.md §2`).
**Done already:** War Room worklist (Phase 4), Alerts inbox (InForm), Intelligence annotations logic
(3.3), War Room fields/counts (3.2). **This round:** the remaining frontend changes + one backend gap.

Preamble unchanged (see `docs/build-prompts.md §0`). Same rules: functional/data = plain Claude
Code; design = Impeccable targeting InForm; confirm paths by reading; verify with build+lint;
commit atomically; `graphify update .`. **Anchors are hints — the repo has moved since the June
snapshot; read the file.**

Priority order: **R1 Competitors → R2 contrast → R3 severity → R4 clean_headline → R5 Intelligence
→ R6 verify/cleanup.** R1–R3 are cheap and clear the highest-severity + app-wide items; R4 is
backend and can run in parallel.

---

## R1 — Competitors page (the eval's #1 finding, still unshipped)

Competitors is still legacy and untouched: the invisibility bug, paywall tile, non-responsive grid.
Do the functional fixes first (cheap, high-impact), then InForm-migrate reusing the components built
for War Room/Alerts.

### R1.1 — Functional fixes
```
Read first: docs/competitors-page-redesign-spec.md; src/pages/Competitors.tsx; src/lib/motion.ts
(listItem variant); src/components/ui/FilterDropdown.tsx (reuse), Skeleton.tsx, EmptyState.tsx;
src/lib/signalSeverity.ts (shared counts).
Do:
- Fix the invisible-cards bug (parent motion.div inline initial/animate wrapping children
  variants={listItem} — children never resolve "animate"; drive via named variants or animate inline).
- Delete the "Available in paid version" placeholder tile.
- Grid → repeat(auto-fill, minmax(300px,1fr)).
- Add sort (Activity/Recent/Threat/Name, default Activity-desc) + posture filter (reuse FilterDropdown);
  counts via the shared signalSeverity helper (same source as War Room).
Verify build+lint; all cards visible; grid reflows 1/2/3; counts match War Room. Commit.
```
### R1.2 — InForm migration
```
Read first: DESIGN.md; src/styles/inform-tokens.css; src/components/inform/* (reuse SignalCard/
KpiCard patterns built earlier); docs/design/component-references/Signal Card.html.
INFORM: /impeccable polish the competitors page   # migrate the competitor card + sort/filter bar to
   inform tokens (neumorphic content, mono for counts/dates, Signal Indigo), reuse inform components.
Then: /impeccable adapt → clarify → critique → audit the competitors page (per-component).
Verify: no legacy rgba(5,10,68,*) remains on the page; audit contrast/focus/targets pass. Commit per pass.
```

---

## R2 — Shared-component contrast (app-wide, non-negotiable per DESIGN.md)

```
Read first: src/styles/inform-theme.css (.btn-primary, .mw-asset-chip); DESIGN.md (Accessibility —
4.5:1 floor, filled-CTA rule); src/styles/inform-tokens.css (indigo/ink ramps).
Do: .btn-primary is white on --indigo-500 at ~4.2:1 and .mw-asset-chip ~4.4:1 — both below AA. Fix
by darkening the CTA background (use --indigo-600 as the resting fill, or darken text/adjust the
chip fg) until ≥4.5:1, verified. These are shared components — check every consumer (incl. the new
War Room "Ask Ariya" button) still looks right.
INFORM: /impeccable audit  on a page using each, to confirm the fix and catch knock-on regressions.
Verify build+lint. Commit.
```

---

## R3 — Unify severity on `ai_severity` (canonical, with fallback)

Decision: `ai_severity` becomes the single source of truth. It's 62% populated, so it needs a
fallback for the rest — and the two client engines get collapsed into one resolver.
```
Read first: src/lib/signalSeverity.ts (computeSeverity/summarizeSeverity), src/lib/signalMapping.ts
(SIGNAL_SEVERITY_MAP), src/lib/db/index.ts (DbRecentSignal — add ai_severity to the select if absent);
consumers: src/pages/AlertsPage.tsx, WarRoom.tsx, Competitors.tsx, src/components/inform/MarketWeather*.
Do:
1. Add one canonical resolver, e.g. resolveSeverity(signal): ai_severity when present, else the
   asset-aware signalSeverity.computeSeverity fallback (keep the richer fallback, not the static map).
2. Route ALL surfaces through it — Alerts, War Room worklist/drawer, Market Weather, Competitors —
   so no two surfaces can disagree. Retire SIGNAL_SEVERITY_MAP as a severity source (leave type→label
   mapping if still needed for display).
3. Ensure ai_severity is fetched wherever severity is shown.
CAUTION: this can shift displayed severities. Diff a sample of signals before/after; confirm the
worklist row badge still equals its own drawer (they now share the resolver, so they will). 
Verify build+lint. Commit. graphify update .
```

---

## R4 — `clean_headline` (backend — the raw-filing-dump headlines)

The one real synthesis gap: `clean_headline` 0/394, so headlines fall back to raw filing text.
```
Read first: docs/hygiene-check.md §2 (verified DB reality); api/ingest/*.ts AND
supabase/functions/ingest-* (where company_signals rows + synthesis are written); the code path that
fills why_it_matters/suggested_action/ai_severity (those DO get populated — find it); src/lib/
signalMapping.ts (buildReadableHeadline fallback + mapSignal).
Do:
1. Diagnose why clean_headline is 0% while sibling synthesized fields are 62–95% — is the column
   newer than the synthesis step, is the prompt not asking for a title, or is a validation dropping it?
2. Populate clean_headline for existing + new rows (backfill the 394; add to the ingestion synthesis
   going forward). Never emit an accession/filename — entity-decoded, human title.
3. Point mapSignal at clean_headline as primary; keep buildReadableHeadline only as the fallback when
   clean_headline is genuinely absent.
Verify: query shows clean_headline populated; Alerts + War Room rows no longer show raw filing text.
Commit.
```

---

## R5 — Intelligence Feed InForm migration (last legacy page)

Annotations logic/copy already fixed (3.3); the visual system is still legacy `rgba(5,10,68,*)`.
```
Read first: DESIGN.md; src/pages/Portal.tsx; src/styles/inform-tokens.css; src/components/inform/*
(reuse cards/chips); src/components/ui/ProvenanceChip.tsx; docs/design/component-references/*.html.
INFORM: /impeccable polish the intelligence feed   # migrate event/report/market cards, tabs, filter
   bar, deal table to inform tokens; glass chrome / neumorphic content; mono for dates/counts; keep
   the amber-tinted illustrative labeling from 3.3.
Then: /impeccable adapt → clarify → critique → audit the intelligence feed (per-component).
Verify: no legacy rgba on the page; audit passes. Commit per pass.
```

---

## R6 — Verify + cleanup (small, do alongside)

```
- what_changed: confirm the column/values exist (the 27-Jul query didn't list it) BEFORE any work
  that reads it (Alerts one-liner). If absent, either add it to the synthesis or drop references.
- Dead data: remove orphaned reports.json + reportsData + its kalvista.ts export (the Reports/
  Earnings tab is gone; no consumer).
- Minor InForm polish (fold into the page you're already touching, don't sweep):
  Next Up rail month labels render 10px (below the 11px floor) — bump; replace inline-styled sort
  toggle / rail bits with the .seg component recipe.
- suggested_action register (note, not a fix): the 2 hand-authored examples lean hedged ("Review the
  implications of…") vs the spec's concrete voice ("Draft the pediatric positioning line…"). Bake the
  concrete register into the synthesis prompt when Phase 2.2 generates this field at scale.
```

---

## Not in this round (deferred, tracked)
- Worklist touch targets 24–26px — fine for desktop; revisit if touch/tablet becomes real.
- SWOT PaidGate (`CompanyTab.tsx`) + `/pricing` — pending your product decision; then delete
  `PaidGate.tsx`.
- Full re-verification against the live repo — still the durable fix for stale line-number anchors:
  point Cowork at the production branch.

## Sequencing
R1 + R2 first (cheap, high-severity, app-wide). R4 (backend) in parallel. R3 after R1 (Competitors
already routes through the shared count helper, so unify severity once its consumers are all in view).
R5 last (largest visual pass). R6 folded in throughout.
