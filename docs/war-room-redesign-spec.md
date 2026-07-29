# War Room — Pure Redesign Spec

**Project:** Ariya Signals (Ariya Light)
**Author:** David / CI team
**Date:** 26 July 2026
**Status:** Draft for design exploration
**Supersedes:** the "keep-and-fix" approach in `docs/war-room-spec.md`
**Source of truth:** `src/pages/WarRoom.tsx` (route `/`, 1416 lines)
**Companion:** `docs/alerts-ai-synthesis-spec.md`

> **Grounding note:** Verified against the real deployed `WarRoom.tsx` (not the stale `.jsx` prototype). The current page is live-data-driven with derived KPIs and a real clock — it is a well-built briefing page, which is exactly why this redesign is about *reframing the job*, not fixing broken data. The one gated element (Market Implications via `PaidGate`, `WarRoom.tsx:1335`) is removed here as part of the full-product/no-tiers direction.

**Scope:** A ground-up redesign of the War Room, not a patch of the current page. Driven by three goals: **one-screen density** (no scroll), **action orientation** (reframe from "what happened" to "what needs me"), and **focus** (fewer, stronger modules). This spec defines the principles and constraints, then proposes three layout directions with a recommendation. It is deliberately lighter on pixel specifics — the layout choice is a decision for design, not something to hard-code here.

---

## 1. Redesign thesis

Today's War Room answers *"what changed in HAE?"* It is a well-built briefing page. But a briefing is passive: it shows the user seven modules and leaves them to decide what, if anything, to do. The redesign reframes the page around a sharper question:

> **"What needs me right now, and what should I do about it?"**

That single shift cascades through every decision below. The page stops being a dashboard you read and becomes a workspace you act from. Signals that don't demand action recede; signals that do surface with a clear next step attached. Everything that doesn't serve the current decision gets cut or demoted to a linked page.

This is a genuine trade. The current War Room is comprehensive; the redesigned one is opinionated. It will show *less* and assert *more*. That is the point — but it means the design must be confident about what a Head of CI actually acts on in a given session, and be willing to be wrong and iterate.

---

## 2. Design principles

**P1 — One screen, no scroll.** The entire War Room must fit a standard laptop viewport (target 1440×900, functional at 1280×800) without vertical scroll. Scroll lives inside the pages the War Room links to (Alerts, Competitors), not on the command surface itself. This is a hard constraint, not an aspiration — it forces the focus decisions in P2/P3.

**P2 — Action over archive.** Every primary element answers "so what do I do?" A signal is shown because it needs triage, a decision, or a follow-up — not because it exists. Pure reference (full feeds, all competitors, historical digest) moves to linked pages.

**P3 — Ruthless focus.** Cap the War Room at **3–4 modules**. The current seven (KPIs, top signals, tracked competitors, Ask panel, market weather, events, digest) get consolidated or cut. If a module can't justify a permanent slot on a no-scroll page, it doesn't belong here.

**P4 — Truth only.** Every number derived, every sentence AI-synthesized-and-cached. The real page is already largely data-driven — the one thing to fix is the templated `buildWhyItMatters` fallback (`WarRoom.tsx:174–190`), which emits identical copy across unrelated signals when the DB lacks a specific `why_it_matters` (see `war-room-spec.md` §2.3). On a denser page, a single generic line is more damaging, not less.

**P5 — One click to act, one click to inspect.** From any item: a primary action (triage / mark handled / assign) and a path to evidence (the Alerts detail drawer). No third path competing for attention.

---

## 3. What gets cut, and why

Focus is a subtraction exercise. Proposed disposition of today's modules:

| Current module | Disposition | Rationale |
|---|---|---|
| 3 KPI tiles | **Compress** to a single stat bar | Three tiles eat vertical space for numbers users glance at. Collapse to one thin row. |
| Top signals to triage | **Keep — becomes the spine** | This is the action surface. Promote it. |
| Tracked competitors (2×2 cards) | **Cut from War Room** → link | Inspection, not action. Lives on `/competitors`. A one-line "most active competitor" stat can stay in the bar. |
| Ask Ariya panel | **Cut as a module** → keep header button | A full panel for a search box is disproportionate. The header `Ask Ariya` button already exists. |
| Market weather | **Keep — condensed** | The "pressure" read + weekly implications is high-value orientation. Condense to a compact strip. |
| Upcoming events | **Keep — condensed, or fold into bar** | Time-sensitive and action-relevant (prep). Condense to a 3-item strip. |
| Weekly digest | **Cut from War Room** → email/link | It's already an email. Duplicating it on the command surface wastes the no-scroll budget. |
| Customise mode + "Add module" | **Cut** | Placeholder debt on a focused page. Reintroduce later if there's real demand. |

Net: seven modules → **a stat bar + 3 focused modules**.

---

## 4. The action reframe (the core new idea)

Each top signal carries a **suggested next action** and a **handling state** — the mechanism that turns the feed from archive into worklist.

**Handling states** (replaces read/unread as the primary axis):
`Needs triage` → `In progress` → `Handled` / `Dismissed`.

**Suggested next action** — one concrete verb phrase per signal, AI-synthesized at ingestion (same cached pipeline as `why_it_matters`, new field `suggested_action`). Examples grounded in the current demo data:

- Pharvaris RAPIDe-3 date moved → *"Update the competitive timeline; brief commercial on the compressed window."*
- Takeda pediatric label extension → *"Draft the pediatric positioning line for Ekterly before Q3."*
- BioCryst Q1 earnings → *"Pull switching-evidence talking points for the next IR call."*

Guardrails (carry over from the alerts spec): action must be specific to the signal + user's asset; if no defensible action exists, omit it rather than emit filler; keep it factual/next-step, not open-ended strategy. No tiering: this is a single full product, so suggested actions are shown to every user — nothing gated or locked.

**"What needs me" as the organizing count.** The hero metric is not "unread signals" but **items in `Needs triage` + high-severity**. That number, and clearing it, is the job of the page.

---

## 5. Layout directions (pick one)

All three honor P1–P5. They differ in how they spend the no-scroll budget.

### Direction A — "Worklist" (recommended)

A single dominant column: the triage worklist, front and center, with a thin context rail.

```
┌────────────────────────────────────────────────────────────┐
│ Stat bar:  ⚑ 4 need you · 12 unread · Pressure ▲ building · Pharvaris most active │
├─────────────────────────────────────────────┬──────────────┤
│  WHAT NEEDS YOU  (worklist, ~6 rows)         │ MARKET WEATHER│
│  ─────────────────────────────────────────  │ (condensed)   │
│  ⚑ HIGH  Pharvaris  RAPIDe-3 moved Q3→Q2     │ Pressure ▲    │
│     → Update timeline; brief commercial      │ 3 implications│
│     [Handle] [Inspect]                       │               │
│  ⚑ HIGH  Takeda  Pediatric label extended    ├──────────────┤
│     → Draft pediatric line before Q3         │ NEXT UP       │
│     [Handle] [Inspect]                       │ 3 events      │
│  ○ MED   BioCryst  Q1 HAE rev $89M +12%      │ + countdowns  │
│     → Pull switching talking points          │               │
│  … (importance / recency toggle)             │               │
└─────────────────────────────────────────────┴──────────────┘
```

- **Spine:** the worklist. Each row = severity · competitor · `clean_headline` · `suggested_action` · `[Handle]` `[Inspect]`. Row expands? No — inspect opens the Alerts detail drawer (shared with the alerts redesign).
- **Rail:** condensed Market weather (pressure status + top implications) and Next up (events).
- **Why recommended:** most directly serves the thesis. One thing dominates — the work — and it's the thing the page exists for. Cleanest path to no-scroll because there's only one list to size.

### Direction B — "Cockpit"

Balanced two-column grid: worklist left, a stacked rail of Market weather + Events + a compact competitor-activity sparkline right. Closer to today's structure but trimmed to 4 modules and forced to one screen.

- **Pro:** familiar; retains a light competitor read on-page.
- **Con:** two competing columns dilute the "one job" focus; harder to keep no-scroll as content grows. Risks recreating the current dashboard, just smaller.

### Direction C — "Single-stream"

No rail at all. One centered column: stat bar → worklist → a single collapsible "Market context" strip at the bottom (pressure + implications inline). Maximum focus, maximum density.

- **Pro:** purest expression of P2/P3; effortless no-scroll; excellent on smaller viewports.
- **Con:** demotes market orientation and events to a strip that's easy to miss; least room for glanceable context. May feel austere to users who valued the briefing feel.

**Recommendation: Direction A.** It commits to the action thesis without discarding the orientation value (weather, events) that makes CI users trust the page. B hedges toward the old dashboard; C may cut orientation too hard. Prototype A first; fall back to C if A still can't hold no-scroll with real data volumes.

---

## 6. Module inventory (Direction A)

| Module | Content | Data |
|---|---|---|
| Stat bar | Needs-you count · unread · pressure status · most-active competitor. One thin row, all derived. | `alertsData`, handling states, `MarketWeather.status` |
| What needs you (worklist) | ~6 rows, Importance/Recency toggle, each with suggested action + Handle/Inspect. | synthesized alert fields + `suggested_action` + handling state |
| Market weather (condensed) | Pressure status + top 2–3 implications. | `MarketWeather` (synthesized, cached) |
| Next up | Next 3 events with countdowns. | `eventsData`, filtered future |

Everything else is a link: All signals → `/alerts`, All competitors → `/competitors`, full digest → email/`/myspace`.

---

## 7. Data dependencies

Depends on the alerts pipeline (`alerts-ai-synthesis-spec.md` §2.3) plus new fields:

```ts
interface Alert {
  // ...existing synthesized fields...
  suggested_action: string | null      // AI, cached at ingestion, asset-aware, always shown
  handling_state: 'needs_triage' | 'in_progress' | 'handled' | 'dismissed'
  handled_by?: string
  handled_at?: string
}
```

`handling_state` needs persistence beyond `localStorage` if triage is meant to be shared/tracked across sessions or teammates — decide in open questions. Market weather / implications already exist via `getMarketImplications()` (`DbMarketImplication`) — reuse that data layer (`src/lib/db`), just remove the `PaidGate`. The real page uses `lib/db` + hooks, not local JSON.

---

## 8. Acceptance criteria

- [ ] Full War Room fits 1440×900 and 1280×800 with **no vertical scroll**, at realistic data volume.
- [ ] Page is capped at a stat bar + 3 modules; competitors grid, Ask panel, weekly digest, and customise mode are removed from the War Room.
- [ ] Every top signal shows a specific `suggested_action` or omits the line — never filler.
- [ ] Handling state (`needs triage → in progress → handled/dismissed`) is the primary axis; "needs you" is the hero count and reconciles with the Alerts page.
- [ ] No hardcoded prose or invented numbers anywhere; all synthesized values cached, stable across refreshes.
- [ ] Every item offers exactly one primary action (Handle) and one inspect path (Alerts detail drawer) — no third competing CTA.
- [ ] No feature-gating anywhere — `suggested_action` and all synthesized content render for every user.

---

## 9. Open questions

1. **Is triage shared or personal?** If `handling_state` should persist across devices or be visible to a team, it needs a backend store, not `localStorage`. This is the biggest scoping decision.
2. **What defines "needs you"?** Severity threshold, unhandled state, asset-relevance, or a combination? The hero count is only trustworthy if the rule is explicit.
3. **Suggested-action quality bar** — what's the fallback when the model can't produce a specific, defensible action? (Omit vs. show a generic "review".) Recommend omit, per P4.
4. **Does cutting the competitors grid lose a valued glance?** Validate with users before removing — a single "most-active competitor" stat in the bar may not replace the 2×2 read. Cheap to test.
5. **Personalization vs. caching** — same tension as the alerts spec: per-user asset context breaks one-call-per-signal economics; asset-scoped variants preserve them.
