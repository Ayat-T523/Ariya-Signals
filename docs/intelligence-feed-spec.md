# Intelligence Feed — Change Spec

**Project:** Ariya Signals (Ariya Light)
**Author:** David / CI team
**Date:** 26 July 2026 (re-grounded against real `.tsx` tree)
**Source of truth:** `src/pages/Portal.tsx` (route `/intelligence`, 2211 lines)
**Companion:** `docs/alerts-ai-synthesis-spec.md`

**Scope:** Remove the coming-soon tab, replace hardcoded/templated interpretive copy with cached AI synthesis, and reframe prescriptive "what to do" language. This is a single full product — no tiering; all content is shown to every user.

---

## 0. Grounding correction (read first)

An earlier draft of this spec was written against the stale `ariya-signals-main/src/pages/Portal.jsx` prototype and claimed the eval's findings *"don't exist in the code."* **That was wrong — the eval was accurate.** Verified against the real deployed `src/pages/Portal.tsx`, all of the eval's Intelligence Feed findings are present:

- **"Earnings Filings · Coming soon" disabled tab — confirmed.** `Portal.tsx:533`: `{ label: 'Earnings Filings', icon: FileText, disabled: true, disabledLabel: 'Coming soon' }`. It ships in production as a dead tab.
- **Prescriptive "Why this is relevant" + "Actionable follow up" — confirmed.** `buildRegulatoryContext` (`106–126`) produces both; they render on event cards at `897–913`. The copy is prescriptive strategy — e.g. *"Flag to medical affairs if a competitor product is under review,"* *"Escalate to medical affairs if this relates to a direct competitor product,"* *"Update competitor regulatory timelines."*
- **Hardcoded leadership annotations — confirmed.** `LEADERSHIP_ANNOTATIONS` (`201+`) plus the templated fallbacks in `buildRegulatoryContext` produce identical copy across unrelated events of the same type.

Two things the earlier draft flagged that are **not** issues in the real code: the clock is live (`TODAY = new Date()`, `Portal.tsx:25`), and there is no "contact your CI team to configure" internal-leak fallback (that was `.jsx`-only). No `PaidGate` on this page.

---

## 1. Problems in the current code

1. **Coming-soon tab in production.** `Portal.tsx:533` ships a disabled "Earnings Filings · Coming soon" tab. Placeholder debt on a customer-facing surface.

2. **Prescriptive interpretive copy is templated, not synthesized.** `buildRegulatoryContext` (`106–126`) returns hardcoded `whyRelevant`/`actionableFollowUp` strings keyed by EMA meeting type (CHMP/PRAC/other). Every CHMP event renders the same two sentences; every PRAC event the same. This is the boilerplate failure the eval flagged — a value-add line that reads as filler because it repeats.

3. **Hardcoded leadership annotations.** `LEADERSHIP_ANNOTATIONS` (`201+`) has one static `expect`/`surprise` (or equivalent) pair per event type, so annotations repeat across unrelated events.

4. **Register: prescriptive "what to do."** The actionable follow-ups prescribe internal actions ("flag to medical affairs", "escalate"). On a full product this is a legitimate feature, not a gating problem — but the copy should be *specific and correct per event*, not generic prescriptions bolted onto every regulatory item. Decide the editorial register deliberately (see §2.3).

5. **Report `haeExtract` is a raw extract.** Rendered directly (`Portal.tsx:1298`, `1414`) in a tinted box. Labeled honestly ("HAE extract") but unsynthesized — inconsistent with the synthesized-summary approach elsewhere.

---

## 2. Changes

### 2.1 Remove the coming-soon tab

Delete the disabled "Earnings Filings" tab (`Portal.tsx:533`). Hide not-ready features rather than shipping dead tabs. Bring it back as a real tab only when the data exists.

### 2.2 Replace templated interpretive copy with cached AI synthesis

Remove the hardcoded strings in `buildRegulatoryContext` (`106–126`) and the static `LEADERSHIP_ANNOTATIONS` (`201+`). Generate `why_relevant` / `actionable_follow_up` / `expect` / `surprise` **per event** at ingestion, via the same cached synthesis pipeline as the alerts spec (§2.1 — generate once, store, render string; never at page load). Inputs: the specific event (title, type, attending competitors, expected topics) + the user's asset context (Ekterly/HAE). Output stored on the event record:

```ts
interface EventAnnotation {
  why_relevant: string
  actionable_follow_up: string | null   // omit if no defensible action
  expect?: string
  surprise?: string
  generated_at: string
}
```

Guardrails: specific to the event + asset; if no defensible line exists, **omit** it rather than emit a generic prescription.

### 2.3 Decide the register for "actionable follow up"

This is a full product, so prescriptive interpretation is allowed — the question is quality, not gating. Recommended: keep it **factual and event-specific** ("PDUFA expected late 2026; watch for the FDA acknowledgement letter") rather than generic internal-process prescriptions ("flag to medical affairs") that apply to every regulatory event identically. If synthesis can't produce something specific, omit the line.

### 2.4 Synthesize the report HAE extract (or keep raw, but decide)

Pick one for consistency:
- **(a)** Add a synthesized one-line `hae_summary` above the raw `haeExtract` (`Portal.tsx:1298`, `1414`), and collapse the raw extract behind "Show extract" — mirrors the alerts synthesis-leads-evidence-follows pattern.
- **(b)** Keep `haeExtract` if it's a clean human-pulled quote, but ensure it's entity-decoded and never a raw filing dump.

Recommend (a) for consistency with the alerts and War Room treatment of evidence vs. synthesis.

---

## 3. What to preserve

- The tab structure (Events / [removed] / Market Developments) and the signal filter tabs.
- **Expected topics** on event cards — specific, event-level, useful. Keep.
- The Deals landscape table, HTA status badges, and confidence indicators — strong, dense data views.
- The live/illustrative badges and 90-day timeline strip.
- The live clock (`TODAY = new Date()`) — already correct.

---

## 4. Data model dependencies

```ts
interface Event {
  // ...existing factual fields (title, type, date, location, attendingCompetitors, expectedTopics, note)...
  annotation?: EventAnnotation | null   // synthesized, cached, always shown (§2.2)
}

interface Report {
  // ...existing fields...
  hae_summary?: string                  // synthesized one-liner (§2.4 option a)
  haeExtract: string                    // entity-decoded raw extract, behind "Show extract"
}
```

Data flows through the real `.tsx` data layer (`lib/db` + JSON reference data), consistent with the rest of the app.

---

## 5. Acceptance criteria

- [ ] The disabled "Earnings Filings · Coming soon" tab (`Portal.tsx:533`) is removed.
- [ ] `buildRegulatoryContext` and `LEADERSHIP_ANNOTATIONS` hardcoded strings are gone; interpretive copy is synthesized per event and cached — no verbatim repetition across events of the same type.
- [ ] `actionable_follow_up` is event-specific or omitted — no generic prescriptions bolted onto every regulatory item.
- [ ] Report extract is entity-decoded and, if kept raw, behind a disclosure; no raw filing dumps or HTML entities.
- [ ] No feature-gating anywhere on the page (full product); "Leadership priority" stays a filter, not a paywall.

---

## 6. Open questions

1. **Annotation scope** — per-event-per-asset breaks the caching economics (same tension as alerts §6 and War Room §8). Asset-scoped variants preserve them. Which?
2. **Register** — confirm how prescriptive the "actionable follow up" should be (factual watch-items vs. internal-action prescriptions).
3. **Report extract** — is `haeExtract` a clean human-pulled quote or a raw dump? Determines whether §2.4(a) synthesis is needed or (b) suffices.
