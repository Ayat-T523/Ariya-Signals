# War Room — Reference & Fix Spec

**Project:** Ariya Signals (Ariya Light)
**Author:** David / CI team
**Date:** 26 July 2026 (re-grounded against real `.tsx` tree)
**Source of truth:** `src/pages/WarRoom.tsx` (route `/`, 1416 lines)
**Companion:** `docs/alerts-ai-synthesis-spec.md`, `docs/war-room-redesign-spec.md`

**Scope:** Document the real War Room and specify the (now narrow) fixes it needs. This is the keep-and-fix version; the pure redesign lives in `war-room-redesign-spec.md`.

> **Grounding correction:** An earlier draft of this spec was written against the stale `ariya-signals-main/src/pages/WarRoom.jsx` prototype and claimed the War Room was full of hardcoded constants, fake KPI numbers, and a frozen clock. **That was wrong.** The real deployed `WarRoom.tsx` is live-data-driven and largely trustworthy. This version corrects the record. The genuine issues are far narrower than the prototype implied.

---

## 1. Why the War Room is the reference page

The War Room gets the mental-model order right (*what changed → what matters → who to inspect → what's coming*) and, unlike the prototype, is backed by a real data layer. It loads live signals, calendar events, market implications, and assets (`getRecentSignals`, `getMarketImplications`, etc., around `WarRoom.tsx:860–878`), derives its KPIs, and computes relative times against the real clock. Keep the structure. The fixes below are targeted.

---

## 2. Current design (reference documentation)

### 2.1 Page structure

```
Header  ── timestamp · greeting · "state of HAE" summary · [Ask Ariya] [Customise]
KPI strip (3-up) ── New this week · Unread signals · High importance
2-column grid:
  LEFT (fluid)                          RIGHT (380px fixed)
  ├─ Top signals to triage              ├─ Market weather · Ekterly
  ├─ Tracked competitors                ├─ Upcoming events
  └─ Ask Ariya panel                    └─ Weekly digest
Edit mode: "+ Add module" placeholder
```

### 2.2 Section-by-section behavior (as built, verified in `WarRoom.tsx`)

| Section | Data source | Status |
|---|---|---|
| KPI: New this week | `newThisWeek` — real count, last 7 days (`~1078`) | **Derived. Trustworthy.** |
| KPI: Unread signals | `unreadCount` + `pharvarisUnread` + `trialAlerts`/`commercialAlerts` (`~919–1094`) | **Derived. Trustworthy.** |
| KPI: High importance | `highUnread` + `highCaption` (`~1100`) | **Derived. Trustworthy.** |
| Top signals to triage | live feed, sorted; Importance/Recency toggle | **Trustworthy.** |
| Tracked competitors | watched competitors + live signal summaries | **Trustworthy.** |
| Market weather → "What moved this week" | live recent signals, with graceful empty states (`~1324–1330`) | **Trustworthy.** |
| Market weather → **Implications** | **`<PaidGate label="Market Implications" …/>` (`1335`)** — the block is locked, not rendered | **Gated (must change — §3.2).** |
| Upcoming events | live calendar, filtered future | **Trustworthy.** |
| Weekly digest | `digestItems` — top 3 relevant live signals (`~989–990`) | **Derived. Trustworthy.** |
| Clock / relative times | `new Date()` / `Date.now()` throughout (`~369–394`, `886`, `946`) | **Live. Not frozen.** |

### 2.3 Genuine issues (short list)

1. **Boilerplate "why it matters" fallback.** `buildWhyItMatters` (`WarRoom.tsx:174–190`) returns the DB `why_it_matters` when present, but otherwise falls back to a **templated per-signal-type string**. The eval's flagged text — *"Leadership change at {competitor} — often precedes commercial or strategic pivots. Monitor upcoming messaging and field activity."* — is line `180–181` verbatim. When the DB lacks `why_it_matters`, unrelated signals of the same type render identical copy.

2. **Market Implications is PaidGate-locked** (`1335`). On a full product with no tiers this must be removed and the real implications rendered (they're already loaded as `marketImplications` at `~877`).

3. **Numeric consistency across views.** Per-competitor counts must match the Competitors list and profile (the eval caught Takeda "2 medium" vs "134"). Use one shared count helper and label every window.

---

## 3. Changes

### 3.1 Fix the boilerplate "why it matters"

Route `why_it_matters` through the ingestion-time AI synthesis pipeline (see `alerts-ai-synthesis-spec.md` §2) so every signal carries a specific, asset-aware, cached `why_it_matters`. Then `buildWhyItMatters` no longer needs a templated fallback — if synthesis produced nothing defensible, **omit the line** rather than emit the generic per-type string. Delete the hardcoded switch-case templates at `WarRoom.tsx:174–190`.

### 3.2 Remove the PaidGate on Market Implications

Delete `<PaidGate label="Market Implications" …/>` (`1335`) and render the loaded `marketImplications` (asset-aware strategic rollup) inline for every user. This is a full product with no tiers — nothing here is gated. (Same treatment for `PaidGate` everywhere else: SWOT in `CompanyTab.tsx:376`, and the `/pricing` page — see the cross-cutting note in the Competitors spec.)

### 3.3 Enforce numeric consistency

Per-competitor and per-window counts must come from one shared helper used by the War Room, Competitors list, and competitor profile, so the same competitor never shows different numbers on different pages. Every windowed count labels its window ("last 7 days", "this quarter", "all time") explicitly.

### 3.4 Consume synthesized alert fields

Top-signal cards should read the cached synthesized fields (`clean_headline`, `why_it_matters`, `signal_type`) from the alerts pipeline rather than re-deriving text, and must never render raw source (`source_raw` stays in the Alerts detail view). Entity decoding and clean headlines happen at ingestion, not in the War Room.

---

## 4. Numeric consistency (cross-view)

Reconcile against a single source of truth: unread count == Alerts page; tracked-competitor count == Competitors page; per-competitor signal counts == competitor profile and Competitors list. Label every time window so a 7-day number and an all-time number are never mistaken for each other.

---

## 5. Data model dependencies

Depends on the alerts pipeline's synthesized fields (`clean_headline`, `what_changed`, `why_it_matters`, `signal_type`, `severity`, `source_meta`) — see `alerts-ai-synthesis-spec.md` §2.3. The Market Implications rollup already exists as `DbMarketImplication` via `getMarketImplications()`; it just needs the gate removed. No new hardcoded artifacts required — the real page is already data-driven.

---

## 6. What to preserve (do not "improve")

- Section ordering and the 2-column split — the model layout.
- The live data layer and derived KPIs — already correct; don't replace with static values.
- The Importance/Recency toggle on Top signals; the graceful empty states in Market weather.
- Right-rail prioritization (Market weather → Events → Digest).
- Customise mode's show/hide + reset. Note: the "+ Add module" placeholder should not carry "full version" upsell copy — this *is* the full version; use neutral "Coming soon" or remove.
- Do **not** let the embedded Ask Ariya panel grow in prominence.

---

## 7. Acceptance criteria

- [ ] `buildWhyItMatters` templated fallback (`174–190`) removed; `why_it_matters` comes from cached synthesis, or the line is omitted — no identical copy across unrelated signals.
- [ ] `PaidGate` on Market Implications (`1335`) removed; real implications render for every user.
- [ ] No feature-gating anywhere in the War Room (full product).
- [ ] Per-competitor / windowed counts reconcile with Alerts, Competitors, and profile (single source of truth); every window labeled.
- [ ] Top-signal cards read synthesized fields; no raw source or HTML entities render.
- [ ] "+ Add module" placeholder carries no "full version" upsell copy.

---

## 8. Open questions

1. **Market Implications refresh cadence** — how often is `getMarketImplications()` regenerated, and is it AI-synthesized upstream or curated? Determines freshness vs. cost.
2. **Shared count helper** — confirm one canonical per-competitor/per-window count function exists (or create it) for War Room + Competitors + profile.
3. **Personalization vs. caching** — per-user asset context for `why_it_matters`/implications breaks one-call-per-signal economics; asset-scoped variants preserve them (same tension as alerts §6).
