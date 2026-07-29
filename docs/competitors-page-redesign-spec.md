# Competitors Page — Redesign Spec

**Project:** Ariya Signals (Ariya Light)
**Author:** David / CI team
**Date:** 26 July 2026
**Status:** Draft for implementation
**Source of truth:** `src/pages/Competitors.tsx` (route `/competitors`), 864 lines
**Companion:** `docs/alerts-ai-synthesis-spec.md`, `docs/war-room-spec.md`

**Scope:** Redesign the Competitors list page. Fix the invisible-cards bug, remove the paywall artifact, add prioritization/scannability the current grid lacks, and reconcile activity counts with the rest of the product. This is a full product with no tiers (see project memory).

---

## 0. Which tree is real (read first)

An earlier draft of this spec was written against `ariya-signals-main/src/pages/Competitors.jsx` — a **stale, non-deployed JavaScript prototype** nested in the repo (no Framer Motion, no Supabase, no PaidGate). That was a mistake. The **real, deployed** app is the top-level TypeScript tree (`.vercel/repo.json` → `"directory": "."`), and this spec is now grounded there: `src/pages/Competitors.tsx`, 864 lines. This matches `CLAUDE.md` and the June eval exactly.

**The eval was accurate.** Every one of its Competitors findings is real in `Competitors.tsx`:

- **Invisible cards — confirmed.** Lines ~810–827: the grid is a `<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>` passing **inline objects**, wrapping children `<motion.div variants={listItem}>`. Because the parent animates via inline props rather than named variant states (`"initial"`/`"animate"`), the children's `listItem` variant never receives the `"animate"` state to resolve to — so each card stays at the variant's initial `opacity: 0`. The three tracked-competitor cards are in the DOM but invisible. `listItem` is defined in `src/lib/motion.ts`.
- **Non-responsive grid — confirmed.** Line 817: `gridTemplateColumns: 'repeat(3, 1fr)'`, hardcoded, no breakpoint hook. Won't reflow on narrow viewports.
- **Paywall placeholder — confirmed.** Lines ~830–857: a dashed "Add competitor / **Available in paid version**" tile renders after the (invisible) cards, so the painted page reads as empty-plus-paywall.

**Also worth noting for other specs:** the real tree has genuine paid-gating (`PaidGate.tsx` used for Market Implications and SWOT, plus a `/pricing` page). Per the "full product, no tiers" decision, all of that comes out — see §2.1 and the other specs.

---

## 1. Problems in the current code

1. **Invisible cards (highest priority).** The variant-propagation bug at `Competitors.tsx:~810–827` leaves all tracked-competitor cards at `opacity: 0`. The page paints as empty space plus the paywall tile — it breaks the primary competitor-inspection journey and reads as monetization-first. Fix first (§2.0).

2. **The paywall card — and now nonsensical.** The dashed placeholder (`Competitors.tsx:~830–857`) reads *"Add competitor · Available in paid version."* It's the one non-functional element, it appears after the (invisible) cards, and on a **full paid product** the "Available in paid version" copy is self-contradictory. It made the page read as monetization-first in the eval. Remove it.

3. **No prioritization.** The page maps all competitors in raw JSON order into a flat grid. For a CI lead tracking a class, there's no way to sort by threat, activity, or recency, and no way to filter by strategic posture. Every competitor gets equal visual weight regardless of how active or threatening it is — the opposite of a monitoring tool's job.

4. **Activity counts risk contradicting other views.** Per-competitor signal counts must reconcile with the War Room "Tracked competitors" cards and the competitor profile. The eval caught exactly this mismatch (Takeda "2 medium" in War Room vs "134" on the list). Every count must come from one source of truth and label its window explicitly.

5. **Non-responsive grid.** `Competitors.tsx:817` hardcodes `repeat(3, 1fr)` — won't reflow to 1–2 columns on tablet/phone, unlike the War Room grids.

---

## 2. Changes

### 2.0 Fix the invisible-cards bug (do first)

At `Competitors.tsx:~810–827`, either:
- give the parent grid named variants and drive children through them — `<motion.div variants={staggerContainer} initial="initial" animate="animate">` so each child's `variants={listItem}` resolves the `"animate"` state; **or**
- drop the child `listItem` variant and animate the cards inline (`initial={{opacity:0}} animate={{opacity:1}}`), matching the parent's inline approach.

Either restores all cards. Add a render-correctness check so an invisible-content regression is caught (the eval flagged this as the #1 issue precisely because nothing errored — the cards were just invisible).

### 2.1 Remove the paywall placeholder entirely

Delete the dashed "Add competitor / Available in paid version" tile (`Competitors.tsx:~830–857`). No placeholder, no "paid version" copy. If an "add/manage competitors" action is ever real, it belongs as a normal button in the header next to the title, not as a dead card padding the grid. Until it's functional, it doesn't appear.

### 2.2 Add prioritization — sort + filter controls

Give the page a lightweight control bar above the grid (mirror the `FilterDropdown` pattern already used on the Intelligence Feed's Reports tab for consistency):

- **Sort by:** Activity (this quarter, default) · Most recent signal · Threat level (posture rank) · Name (A–Z).
- **Filter by posture:** multi-select over the `strategicPosture` values (`Emerging direct threat`, `Adjacent oral competitor`, etc.).

Default sort = **Activity this quarter, descending**, so the most active competitors surface first. Threat-level sort needs a defined rank for `strategicPosture` (e.g. Emerging direct threat > Emerging oral/gene > Adjacent > Incumbent) — define it once and reuse the existing `POSTURE_CONFIG` color mapping so threat reads visually too.

### 2.3 Reconcile activity counts (single source of truth)

The per-competitor signal count must come from one shared helper used by the Competitors list, the War Room "Tracked competitors" cards, and the competitor profile — so the same competitor never shows different numbers on different pages. Every count keeps an **explicit window label** ("this quarter", "last 7 days", "all time"); a quarter number and a 7-day number must never be presented as if comparable. See `war-room-spec.md` §4 (numeric consistency).

### 2.4 Make the grid responsive

Replace `Competitors.tsx:817` `repeat(3, 1fr)` with `repeat(auto-fill, minmax(300px, 1fr))` (or the project's responsive `data-*` grid hook used elsewhere) so cards reflow to 1–2 columns on tablet/phone.

### 2.5 Real clock

Replace any hardcoded quarter/window cutoff with a computed boundary from the shared injectable "now" (same clock used by War Room and Intelligence Feed). "This quarter" then means the actual current quarter.

### 2.6 Card content — align with the synthesis layer

The card's "last signal" date and activity count should read from the same synthesized/normalized alert data as everywhere else. No raw data or filenames surface on the card (structured fields only — keep it that way).

---

## 3. Target page structure

```
Header:  Tracked Competitors · {n} tracked · HAE therapeutic area
Control bar:  [Sort ▾]  [Posture ▾]              ({n} shown)
Grid (responsive auto-fill, minmax 300px):
  ┌ Takeda ────────┐ ┌ Pharvaris ─────┐ ┌ BioCryst ──────┐
  │ badge + posture │ │                │ │                │
  │ one-liner       │ │   (sorted by   │ │                │
  │ pipeline · last │ │    activity)   │ │                │
  │ activity dots   │ │                │ │                │
  └────────────────┘ └────────────────┘ └────────────────┘
  … all tracked competitors, no paywall tile
```

Once the variant bug is fixed (§2.0), lead with the real competitor cards. The card design itself (badge, posture chip, one-liner, pipeline count, last signal, quarterly activity dots) is good and stays; only ordering, the control bar, and count-sourcing change.

---

## 4. What to preserve

- The card layout and the `ActivityDots` visualization — a nice, scannable density cue. Keep.
- The existing posture color coding — reuse it for the threat sort/filter so posture reads visually.
- Window labeling on counts ("this quarter") — keep and extend to every count.
- The existing `filter` state and any timeline view already in `Competitors.tsx` — build the sort/filter bar (§2.2) on top of what's there rather than replacing it.

---

## 5. Data model / dependencies

No new synthesized fields required — this page consumes existing structured competitor and alert data. Dependencies:

- Shared quarterly/window activity helper (used by War Room + profile) — the single source of truth for per-competitor counts.
- Shared injectable "now" for the quarter boundary.
- A defined `strategicPosture` → threat-rank map for the threat sort.

The real `Competitors.tsx` pulls live/enriched data via `src/lib/db` and hooks (`useApp` watched competitors, `useEnrichedTimelineRows`, signal-summary maps), not local JSON — so counts already flow from the data layer. Keep that; just ensure the per-competitor count helper is the *same* one the War Room and profile use.

---

## 6. Acceptance criteria

- [ ] All tracked-competitor cards render visibly (variant bug fixed); a render-correctness check guards against regression.
- [ ] The "Add competitor / Available in paid version" placeholder is gone; no paywall or disabled tile anywhere on the page.
- [ ] Sort (Activity / Recent / Threat / Name) and posture filter work; default is Activity-desc.
- [ ] Per-competitor signal counts match the War Room and competitor profile for the same window (single source of truth), and every count labels its window.
- [ ] "This quarter" reflects the actual current quarter via the shared clock, not a frozen date.
- [ ] Grid reflows to 1–2 columns at tablet/phone widths (no hardcoded `repeat(3, 1fr)`).
- [ ] No paid-gating, locked states, or upsell copy anywhere (full product).

---

## 7. Open questions

1. **Is "add/manage competitors" ever a real feature?** If competitors are inferred from tracked assets (as onboarding does), the page may never need an add action at all — in which case there's nothing to replace the removed placeholder with.
2. **Threat-rank definition** — confirm the ordering of `strategicPosture` values for the threat sort.
3. **Delete the dead `ariya-signals-main/` tree?** The stale `.jsx` prototype in the repo is what caused the earlier mis-grounding. Removing it prevents future confusion. (Repo-hygiene decision, not this page.)
