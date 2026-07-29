# Alerts Module Redesign + AI Synthesis Pipeline — Spec

**Project:** Ariya Signals (Ariya Light)
**Author:** David / CI team
**Date:** 24 July 2026
**Status:** Draft for implementation
**Source of truth:** `src/pages/AlertsPage.tsx` (route `/alerts`, 800 lines); mapping in `src/lib/signalText.ts`, `signalMapping.ts`, `transformers.ts`
**Scope:** (1) Ingestion-time AI synthesis pipeline; (2) Alerts module redesign from cards → inbox table + detail drawer.

> **Grounding note:** This spec is verified against the real deployed TypeScript tree (`src/pages/AlertsPage.tsx`), not the stale `ariya-signals-main/*.jsx` prototype. Current structure per card: type + severity badges, date, headline with unread dot (`~197–215`), `whatHappened` body rendered in full with **no line-clamp** (`~220–227`), a tinted "Why it matters" strip (`~231–246`), and a collapsible "What changed" label-diff panel (`~248–305`). The Grouped view (`~487–503`) drops every signal into a single group with the copy *"AI-generated theme grouping will be available in a future update."* No PaidGate on this page.

---

## 1. Problem statement

The current Alerts module fails on two fronts:

1. **Raw data is rendered directly to the user.** Alert cards render `whatHappened` in full with no truncation (`AlertsPage.tsx:~220–227`); raw HTML entities (`&#8220;`) and filename-style headlines (`EX-99.1 …htm`) appear because they originate upstream in the signal mapping (`lib/signalText.ts` / `signalMapping.ts`) and render unsanitized. The "Why it matters" line is often identical boilerplate across unrelated signals (the templated fallback in the shared signal-text logic). Source attribution dominates the insight — the opposite of the product's intent.

2. **The card layout can't scale.** Variable-height cards mean dozens of alerts become an infinite scroll, and the Grouped view collapses everything into one meaningless "live signals" group (`AlertsPage.tsx:~487–503`). A CI user cannot triage at a glance.

The fix has two independent parts that compose: an **AI synthesis layer** between ingestion and storage (fixes data quality), and an **inbox-table + detail-drawer layout** (fixes density and triage). Neither depends on the other, but together they deliver the "fast, scannable monitoring workspace" the product promises.

---

## 2. AI synthesis pipeline

### 2.1 Core principle — synthesize at ingestion, not at render

**Inference runs once per signal, at ingestion. The result is cached on the alert record. The UI only ever reads cached strings.**

This is the central architectural decision. Do **not** generate synthesized fields at render time (per card, on page load).

| | Render-time generation (rejected) | Ingestion-time generation (chosen) |
|---|---|---|
| **Cost** | One LLM call per alert, per pageview | One LLM call per signal, ever |
| **Latency** | User waits on inference to see the feed | UI reads a string; instant |
| **Stability** | Text changes between refreshes | Generated once, never changes |
| **Trust** | Non-deterministic output erodes trust | Deterministic display, stable |
| **QA** | No review surface | Can review/regenerate before publish |

Non-deterministic display text is itself a trust bug: a user who sees "why it matters" say two different things on two refreshes trusts the product *less* than one who sees stable boilerplate. Caching removes that failure mode entirely.

### 2.2 Pipeline stages

```
raw signal ingested (SEC filing, ClinicalTrials.gov, press release, etc.)
  │
  ├─ 1. NORMALIZE (deterministic, no LLM)
  │      • decode HTML entities (&#8220; → “)
  │      • strip markup, collapse whitespace
  │      • capture source metadata: source name, URL, filing type, date
  │
  ├─ 2. SYNTHESIZE (single LLM call per signal)
  │      inputs:  normalized text + competitor + watching user's asset context
  │      outputs: clean_headline, what_changed, why_it_matters,
  │               signal_type, severity, structured_fields
  │
  ├─ 3. VALIDATE (deterministic guards on LLM output)
  │      • headline is not a filename / not empty
  │      • required fields present
  │      • severity ∈ enum; signal_type ∈ enum
  │      • flag for human review if guards fail
  │
  └─ 4. PERSIST
         store all synthesized fields on the alert row
         UI renders these cached fields only
```

Stage 1 (normalize) is deterministic and must run regardless of LLM availability — entity decoding and filename cleanup should never depend on inference. If the LLM step fails, the alert can still render a clean (if less insightful) headline from normalized data rather than raw source.

### 2.3 Synthesized fields (stored on each alert record)

| Field | Source | Description |
|---|---|---|
| `clean_headline` | LLM | Human-readable event title. Never a filename. Max ~90 chars. |
| `what_changed` | LLM | One-line factual summary of the change. Neutral, no interpretation. |
| `why_it_matters` | LLM | Specific, asset-aware implication. See §2.4. |
| `signal_type` | LLM (classified) | Enum: `regulatory`, `clinical`, `leadership`, `partnership`, `commercial`, `financial`, `other`. |
| `severity` | LLM (classified) | Enum: `high`, `medium`, `low`. |
| `structured_fields` | LLM (extracted) | asset, sponsor, phase, region, key dates (e.g. PDUFA). Nullable. |
| `source_raw` | Normalize | Entity-decoded original text, kept for the detail view. |
| `source_meta` | Normalize | Source name, URL, filing type, ingested/refreshed timestamp. |

### 2.4 The "why it matters" prompt — what makes it non-generic

Generic output is not a model limitation; it's a missing-context problem. The synthesis prompt for `why_it_matters` must receive three inputs:

1. **The signal content** (what happened)
2. **The competitor** (who it's about)
3. **The watching user's asset context** — e.g. David tracks sebetralstat (Ekterly) in HAE, with a Q3 2026 PDUFA window.

Context injection is what turns:

> ❌ "Leadership change often precedes commercial or strategic pivots. Monitor upcoming messaging and field activity." *(generic, repeated verbatim)*

into:

> ✅ "Takeda's new HAE commercial lead suggests a relaunch push against Ekterly ahead of your Q3 PDUFA — watch for field-force expansion and payer messaging shifts." *(specific to competitor + user's asset)*

**Prompt guardrails:**
- Must reference the specific competitor and, where relevant, the user's tracked asset.
- If no specific, defensible implication exists, output `null` — the UI omits the line rather than showing filler. **Silence beats generic noise.**
- Factual and forward-looking ("watch for X"), not prescriptive strategy (see §2.5).

### 2.5 No tiering — show everything

This is a single, full product. There is no free/lighter tier to gate against, so **every synthesized field is shown to every user** — including `why_it_matters`. No feature-gating, no locked interpretive layer, no upsell states. The synthesis pipeline exists purely to make the data trustworthy and scannable, not to ration it.

---

## 3. Alerts module redesign

### 3.1 Layout model — cards → inbox table

Replace variable-height cards with a compact, one-row-per-alert table (inbox pattern). Target: **15–20 alerts visible without scrolling**.

**List row anatomy (strict left-to-right hierarchy):**

```
● HIGH  |  BioCryst  |  Q2 earnings: revenue miss vs consensus  |  Regulatory  |  2h ago  |  [Read more] [Save] [✓]
○ MED   |  Takeda    |  CMO departure confirmed                 |  Leadership  |  1d ago  |  [Read more] [Save] [✓]
○ MED   |  Pharvaris |  Phase III interim readout filed         |  Clinical    |  3d ago  |  [Read more] [Save] [✓]
```

| Element | Behavior |
|---|---|
| 1. Severity | Color dot + label. Leftmost. Sortable. |
| 2. Competitor | Logo + name. |
| 3. Headline (`clean_headline`) | Only element that wraps. Max 2 lines, then ellipsis. |
| 4. Signal type + recency | Right-aligned, smallest weight. |
| 5. Actions | Read more (→ detail), Save, Mark read. Icon buttons. |

**No body text, no source dump, no "why it matters" in the list.** All of that lives in the detail view.

### 3.2 Smart default filtering

On load, show only **unread + medium/high severity**. This should surface ~5–15 alerts, not 73.

- Count badge: `Showing 12 of 73 — Show all`
- Users who want the full log opt in explicitly.
- Persist the user's filter/sort choice (localStorage) so triage state survives reloads.

### 3.3 Grouping

If a grouped view is retained, **group by competitor** (or asset, or signal type) — never by backend feed. The current "Live signals · 73 alerts" single group organizes by ingestion source, which is the exact anti-pattern to avoid.

- Three tracked competitors → three collapsible sections.
- Each section shows its top 3 signals + a `See all N` expander.
- Default the grouping dimension to whatever users filter by most.

### 3.4 Detail view (Read more) — where raw evidence belongs

Clicking a row or **Read more** opens a detail view. This is the *only* place raw source text appears — which is precisely what fixes the density problem. Raw text becomes reference material a user chose to open, not a wall they scroll past.

**Recommended: right-side drawer** (not a full route). Keeps the list in view, feels faster, and lets users arrow through alerts triage-style. A full page is acceptable but the drawer is better for a triage workflow.

**Detail layout, top to bottom:**

1. `clean_headline` + severity badge + freshness
2. **What changed** — `what_changed` (AI one-liner)
3. **Why it matters** — `why_it_matters` (AI, asset-aware; always shown; omitted only if `null`)
4. **Structured chips** — asset, sponsor, phase, region, PDUFA/key dates (from `structured_fields`)
5. **Source evidence** — `source_raw` (entity-decoded), clearly labeled "Original source" with link-out to `source_meta.url`. Collapsible.

### 3.5 Interaction details

- **Row click** and **Read more** both open the detail drawer.
- **Keyboard triage:** ↑/↓ move selection, Enter opens detail, `E` marks read, `S` saves. (Nice-to-have; supports the inbox mental model.)
- **Mark read** updates the read-alerts set (existing `pharma-inc-ciwarroom-read-alerts` localStorage key).
- Detail drawer has prev/next controls to move through the filtered list without closing.

---

## 4. Data model changes

Alert record gains the synthesized + normalized fields from §2.3. Illustrative shape:

```ts
interface Alert {
  id: string
  competitor: string
  // synthesized (cached at ingestion)
  clean_headline: string
  what_changed: string
  why_it_matters: string | null
  signal_type: 'regulatory' | 'clinical' | 'leadership' | 'partnership'
             | 'commercial' | 'financial' | 'other'
  severity: 'high' | 'medium' | 'low'
  structured_fields: {
    asset?: string
    sponsor?: string
    phase?: string
    region?: string
    key_dates?: { label: string; date: string }[]
  }
  // normalized source (for detail view)
  source_raw: string          // entity-decoded, markup-stripped
  source_meta: {
    source_name: string
    url: string
    filing_type?: string
    ingested_at: string
    refreshed_at: string
  }
  // synthesis provenance / QA
  synthesis_status: 'ok' | 'needs_review' | 'failed'
  synthesized_at: string
}
```

All fields import through the existing `src/data/kalvista.ts` re-export hub — do not import JSON directly.

---

## 5. Acceptance criteria

**AI synthesis**
- [ ] No raw HTML entities render anywhere in the feed or detail view.
- [ ] No alert headline is a filename or empty string.
- [ ] `why_it_matters` references the specific competitor and, where relevant, the user's tracked asset — no verbatim repetition across unrelated signals.
- [ ] Synthesized fields are stable across page refreshes (generated once, cached).
- [ ] LLM failure degrades gracefully: a clean normalized headline still renders; alert flagged `needs_review`.

**Alerts layout**
- [ ] Default filtered view fits ≥15 alerts without scrolling on a standard laptop viewport.
- [ ] List rows contain no body text or raw source.
- [ ] Read more / row click opens the detail drawer with source text collapsed by default.
- [ ] Grouped view groups by competitor/asset/type, never by feed.
- [ ] Filter/sort state persists across reloads.

**Tiering**
- [ ] No feature-gating or paid-lock anywhere in the alerts UI — all synthesized fields render for every user (§2.5).

---

## 6. Open questions

1. **Model + cost ceiling** for the synthesis call — which model, and what's the per-signal budget?
2. **Re-synthesis policy** — if an alert is updated upstream, do we regenerate synthesized fields or version them?
3. **Human-in-the-loop** — does `needs_review` block display, or show a degraded card with a review flag?
4. **Asset context source** — where does the pipeline read the watching user's tracked assets from at ingestion time (per-user synthesis vs. per-asset synthesis)? This affects whether `why_it_matters` is generated once globally or per subscriber.

> Note on Q4: if `why_it_matters` must be personalized per user's asset, synthesis is no longer strictly one-call-per-signal — it becomes one-call-per-(signal × asset-context). Consider generating a small set of asset-scoped variants rather than per-user, to preserve the caching economics.
