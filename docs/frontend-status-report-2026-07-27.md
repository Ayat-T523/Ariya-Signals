# Frontend Status Report — Ariya Signals

**Date:** 27 July 2026
**Branch:** `iteration-5`
**Prepared for:** handoff to Claude Cowork/chat — context for scoping the next round of frontend prompts
**Covers:** War Room redesign (Phase 4, complete), Intelligence Feed annotations (sub-step 3.3), War Room fields/counts (sub-step 3.2 close-out), a Supabase migration-tooling fix

---

## 1. What shipped this session, in order

### 3.2 — War Room fields + counts (close-out)
Top-signal cards now read `clean_headline` / `why_it_matters` / `signal_type` from Supabase instead of raw source text. Severity and windowed counts are computed by one shared helper (`src/lib/signalSeverity.ts` — `computeSeverity`, `summarizeSeverity`) consumed by both War Room and Competitors, so the same competitor can't show a different count on different pages. Fixed three places where the UI claimed a "last 7 days" or "last 30 days" window while the underlying fetch was actually 90 days (`NARRATION_DAYS`) — labels now match the real computation. Closed out a P1 contrast finding from the InForm audit: ~10 `rgba(5,10,68,0.50/0.55)` text colors (below WCAG AA) bumped to the established-passing `rgba(5,10,68,0.65)`.

### 3.3 — Intelligence Feed annotations
Removed `buildRegulatoryContext` and `LEADERSHIP_ANNOTATIONS`, the two sources of hardcoded, type-templated interpretive copy that repeated verbatim across unrelated events (every CHMP meeting got the same two sentences, etc.). Replaced with a per-event `annotation` field (`whyRelevant`, `actionableFollowUp | null`, optional `expect`/`surprise`) read as-is from `events.json`, never derived client-side. Two real, hand-authored events already had this data (renamed from the old `ciContext` field); every other event — including all live EMA calendar entries, which carry no per-event distinguishing data — now correctly shows nothing instead of boilerplate. A dual-agent design critique then fixed: illustrative/hypothetical events getting the same visual confidence as sourced fact (now amber-tinted + labeled), the annotation text rendering smaller than the page's own "Expected topics" bullets (now matched), and the `actionable_follow_up` copy register (rewritten toward factual watch-items instead of internal-process prescriptions, per the spec's own guidance).

**Known dead end, not touched:** `reports.json` / `reportsData` (the old "Reports / Earnings Filings" tab's data) is orphaned — the tab was removed in an earlier phase but the data file and its `kalvista.ts` export were never cleaned up. No current consumer.

### Migration tooling fix (ad hoc, user-requested)
`supabase db push` was silently broken: three migrations (`20260624_messaging_snapshots.sql`, `20260624_trial_snapshots.sql`, `20260624_user_profiles.sql`) all shared the literal version `20260624` (Supabase derives version from the numeric prefix before the first underscore), so the CLI's history bookkeeping collided on a duplicate key the moment more than one landed on the same day. Renamed all four migration files (including this session's own new one) to full 14-digit timestamps and reconciled the remote `schema_migrations` table. `supabase db push` now reports "Remote database is up to date." **Anyone adding a new migration should use the full `YYYYMMDDHHMMSS_name.sql` format going forward**, not date-only.

### 4.1 — Triage state persistence [decision made]
**Decision:** `handling_state` (the War Room worklist's `needs_triage → in_progress → handled/dismissed` triage state) is personal and Supabase-backed — new `alert_handling_state` table, same shape and RLS posture as the existing `read_alerts` table (`user_id` + `alert_id` primary key, RLS scoped to `auth.uid()` only). **Not** localStorage, **not** team-shared/visible-to-other-users — there's no team/account concept anywhere in the app yet to support that, and the existing `read_alerts` precedent (already migrated from localStorage to Supabase for exactly this reason) made this the consistent choice. Absence of a row means `needs_triage` (the default), mirroring how `read_alerts` only stores rows for the non-default state.

### 4.2 — War Room rebuilt as an action-first worklist (the big change)
The War Room (`/`, `src/pages/WarRoom.tsx`) was rebuilt from scratch, replacing the old seven-module briefing page (3 KPI tiles, top signals, a 2×2 tracked-competitors grid, a full Ask Ariya panel, market weather, upcoming events, a weekly digest) with **Direction A ("Worklist")** from `docs/war-room-redesign-spec.md`:

- **A glass stat bar** (the only glass surface on the page): needs-you count, signal volume, pressure status, most-active competitor, a link to Alerts.
- **"What needs you"** — the spine. Up to 6 rows, an Importance/Recency toggle, each row one line at rest (severity, competitor, headline, time, a **Handle** state-menu, an **Inspect** button) plus an optional second line for a synthesized `suggested_action`, never filler.
- **A condensed rail**: Market Weather (existing InForm component, used in `compact` mode) + a terse "Next up" events strip (3 items).
- **Cut entirely**: the competitors grid, the Ask panel (kept only as the existing header button), the weekly digest, Customise/"Add module".
- **Inspect reuses the Alerts drawer exactly** — `AlertDetail` was extracted out of `AlertsPage.tsx` into `src/components/inform/AlertDetail.tsx` so both pages share one component, and the worklist now runs through the same `mapSignal()` / `MappedAlert` pipeline `AlertsPage` uses (not a separate WarRoom-only mapper), so a row's severity badge can never disagree with what its own drawer shows.
- **`suggested_action` turned out to already exist and be real, populated data** — 243 of 394 rows in `company_signals`, genuine event-specific text, not boilerplate. The build-prompts brief and `docs/hygiene-check.md` both described it as "missing, pending Phase 2.2" — that assumption was wrong for this field specifically (see §3 below for what's still actually missing).
- P1 hard constraint (no vertical scroll at 1440×900 **and** 1280×800) is met, plus a `(max-width: 1360px), (max-height: 850px)` breakpoint that also covers 1366×768 (a common real laptop size neither target viewport happens to match).
- Full refine pass: distill (nothing left to cut after the module reduction — documented, no changes), adapt (the no-scroll fix above), clarify (stopped overloading the word "live" — the stat bar's signal-volume count now says "N signals," not "N live," since "live" already has a specific, different meaning elsewhere on the page), harden (added a real fetch-error state with Retry — previously a failed fetch just spun the loading skeleton forever; Escape now closes the Handle menu), animate (the Handle menu fades in; marking something handled/dismissed holds the real state write for one short beat so the row doesn't just vanish — **deliberately not using Framer Motion's `AnimatePresence`/exit-animation pattern for this**, because that exact approach was tried for the Alerts inbox in an earlier phase and caused the visible row count to permanently disagree with the real count; this page's core premise is a trustworthy count, so the fix uses a delayed *real* state write instead of an animated *stale* one).
- A dual-agent design critique then caught a real P0: "needs you" originally required `needs_triage`-or-high-severity, so moving a non-high item to `in_progress` (literally "I'm on this") silently dropped it from both the worklist and the hero count — a user interrupted mid-task would find no trace of it. Fixed: any unresolved item (`needs_triage` or `in_progress`) now counts; only `handled`/`dismissed` ever leave. Also fixed a P1: near-duplicate signals (e.g. separate exhibits of the same competitor SEC filing landing as separate `company_signals` rows) were eating multiple of the worklist's scarce 6 slots — added a display-only dedup (competitor + date + type, keep highest severity) before the slice to 6; nothing is deleted, Alerts still shows every row.
- A technical audit (16/20) found one dead import (removed) and documented five remaining findings, listed in §3.

### 4.3 — Triage actions + keyboard
Added the two things the worklist didn't have yet: a **Save** action (wired to the `toggleSavedAlert`/`savedAlerts` that already existed in `AppContext` from the Alerts work, surfaced in the Inspect drawer's footer — deliberately *not* a third per-row button, since the redesign spec caps each row at exactly Handle + Inspect) and **full keyboard triage**, mirroring `AlertsPage`'s existing ↑/↓ + E + S scheme: with the drawer closed, ↑/↓ move a real (focus-ring-visible) roving selection through the worklist, Enter opens Inspect for the selected row, E/S act on it directly; with the drawer open, ↑/↓ walk prev/next through the worklist, E advances the open item's triage state one step, S toggles saved.

---

## 2. Current architecture snapshot

**InForm migration status by page:**
| Page | Status |
|---|---|
| War Room (`/`) | ✅ Fully rebuilt in InForm this session |
| Alerts (`/alerts`) | ✅ InForm (earlier phase) |
| Intelligence Feed (`/intelligence`, `Portal.tsx`) | ❌ Still legacy (`rgba(5,10,68,*)`) — annotation content/logic fixed in 3.3, visual system untouched, no phase scheduled |
| Competitors (`/competitors`) | ❌ Still legacy, untouched |

**Two severity engines coexist, unreconciled — real architectural debt to be aware of:**
- `src/lib/signalSeverity.ts` (`computeSeverity`/`summarizeSeverity`) — asset/lexicon-aware, used by War Room's Market Weather and by Competitors.tsx.
- `src/lib/signalMapping.ts` (`mapSignal`, static `SIGNAL_SEVERITY_MAP` per `signal_type`) — used by Alerts and now by the War Room worklist/drawer (deliberately, for row/drawer consistency — see §1).
- These can disagree on the same signal. Reconciling them app-wide was explicitly out of scope for every phase this session touched; flagged each time it came up.

**Data layer reality check** (queried live against the `qlvzgqbmcmbdqixktqfa` Supabase project, `company_signals` table, 394 rows):
| Column | Populated | Notes |
|---|---|---|
| `suggested_action` | 243/394 (62%) | Real, event-specific, already wired into the worklist and Alerts drawer this session |
| `why_it_matters` | 376/394 (95%) | Already wired, pre-existing |
| `ai_severity` | 243/394 (62%) | Exists, **not consumed anywhere in the app** — the app uses its own two severity engines instead |
| `clean_headline` | **0/394 (0%)** | Always empty — every headline shown anywhere in the app is the fallback path (`buildReadableHeadline` or the raw `headline` column), which is why some rows render as raw filing-dump text (e.g. "May 26, 2026 Dear Shareholders Christophe Weber...") |
| `severity` (legacy column) | 15/394 | Effectively unused |

**New this session:** `alert_handling_state` table (personal triage state — see §1, Phase 4.1).

---

## 3. Open items for whoever writes the next frontend prompts

1. **`clean_headline` is genuinely still empty (0/394).** This is the one piece of `docs/hygiene-check.md`'s "AI synthesis pipeline, Phase 2.2, deferred" story that's still accurate — `suggested_action` and `why_it_matters` turned out to already be populated, but headline cleaning was not. Worth deciding whether Phase 2.2 is still needed in full, or just for this one field, before scoping more prompts around it. Symptom: some Alerts/War Room rows show raw SEC filing text as their headline.
2. **Severity engine duality** (above) — no page currently shows visibly conflicting severities for the *same* signal because War Room's worklist and Alerts now share one engine, but Market Weather/Competitors use the other. A future prompt could either formally reconcile them or explicitly document the split as permanent.
3. **Two pre-existing shared-component contrast failures**, found during the War Room audit but not fixed there (they're app-wide, not page-scoped): `.btn-primary` (white on `--indigo-500`, ~4.2:1) and `.mw-asset-chip` (~4.4:1) — both under the 4.5:1 AA floor `DESIGN.md` calls non-negotiable. Affects every page using these components, including the new War Room "Ask Ariya" button.
4. **Intelligence Feed and Competitors pages are not InForm-migrated.** No phase currently schedules this. If frontend work continues toward a fully-migrated app, these are the two remaining legacy holdouts (War Room and Alerts are done).
5. **Worklist touch targets** (~24-26px) clear the 24×24 minimum but fall short of the "aim 44×44" `DESIGN.md` target — acceptable for the page's primary desktop/mouse use case, worth revisiting if touch/tablet use becomes a real scenario.
6. **Minor, documented-not-fixed:** Next Up rail's month labels still render at 10px (below the 11px floor the design detector flagged); the sort toggle and a few rail elements use inline styles instead of the system's `.seg` component recipe; `reports.json`/`reportsData` is orphaned dead data.
7. **`suggested_action` register**: the two real, hand-authored examples currently lean more hedged/passive ("Review the implications of...") than the spec's own concrete examples ("Draft the pediatric positioning line..."). Worth a prompt-engineering note if/when Phase 2.2 synthesis actually generates this field at scale.

---

## 4. Commit log (this session, `iteration-5`, chronological)

```
e21d7f7  fix: bring remaining WarRoom text colors to WCAG-AA contrast
32c61c7  fix: replace templated event annotations with per-event synthesized field
6c2598a  polish: clarify + unify event-annotation copy and labels
ac24609  fix: address critique P1/P2 findings on event annotations
7368734  fix: resolve migration version collision on same-day migrations
d5a6f2c  feat: add per-user triage handling_state, Supabase-backed
6a06400  build: redesign War Room as an action-first worklist (InForm, Direction A)
8572412  adapt: fix War Room no-scroll at 1280x800 and real-world laptop sizes
0fd5397  clarify: stop overloading "live" in the War Room stat bar
005fc57  harden: add worklist fetch-error state, Escape closes Handle menu
fd44b3b  animate: Handle menu entrance + resolve-flash, no exit-animation risk
a7bc731  fix: address critique P0/P1/P2/P3 findings on War Room worklist
451fd53  chore: remove dead computeSeverity import (audit finding)
7e5129b  feat: worklist Save action + full keyboard triage (Phase 4.3)
```

Full critique snapshots (heuristic scores, priority issues, persona red flags) are persisted at `.impeccable/critique/` for both the Intelligence Feed annotations and the War Room worklist, if deeper detail is needed than this summary provides.
