// ── Signal type ───────────────────────────────────────────────────────────────
// Canonical display-level type keys. These drive the coloured pill on every card
// surface (War Room, Intelligence Feed, Competitor Profile). Values are kebab-case
// to match the existing TYPE_LABEL_BY_KEY registry in WarRoom.tsx.
//
// DB raw values (press_release, exec_change) are NOT in this union — the
// transformer (Phase 3.2) maps DB → SignalType before any card is rendered.
export type SignalType =
  | 'deal'           // M&A, licensing, strategic alliance — SEC 8-K Item 2.01 / 1.01
  | 'exec-move'      // director / officer appointment or departure — SEC 8-K Item 5.02
  | 'publication'    // press release, data disclosure, conference abstract
  | 'trial-update'   // ClinicalTrials.gov status or phase change
  | 'regulatory'     // approval, PDUFA, CHMP opinion, NICE recommendation
  | 'earnings'       // quarterly / annual financial results
  | 'conference'     // medical congress or investor R&D day
  | 'milestone'      // pipeline milestone (filing, readout, IND submission)
  | 'market-dev'     // HTA outcome, pricing decision, reimbursement update
  | 'label-change'   // approved labelling update (indication expansion, new warning)
  | 'field-signal'   // commercial field intelligence (market access, share shift)

// ── Base card schema ──────────────────────────────────────────────────────────
// Single interface accepted by every card component across all surfaces.
// Design constraints (see Phase 3 spec):
//   - null enrichment fields collapse gracefully — no layout branching
//   - summary is cleaned prose or null, never raw SEC boilerplate
//   - title is composed by the transformer, never a raw headline slice
//   - provenance replaces per-component confidence hardcoding (removed inferenceDepth)
export interface BaseCard {
  // ── Identity ────────────────────────────────────────────────────────────────
  type: SignalType
  title: string      // composed, never sliced from raw filing text
  date: string       // ISO date YYYY-MM-DD
  entities: string[] // canonical competitor / asset names (not slugs)
  summary: string | null // cleaned prose paragraph or null — never garbage text

  // ── Urgency ─────────────────────────────────────────────────────────────────
  severity: 'high' | 'medium' | 'low'

  // ── Provenance ───────────────────────────────────────────────────────────────
  // Replaces the hardcoded ConfidenceIndicator props that were scattered across
  // components. sourceCoverage and dataFreshness are computed per-card from the
  // underlying data, not hardcoded to 'high'.
  provenance: {
    sourceLabel: string              // "SEC 8-K" / "EMA" / "ClinicalTrials.gov" / "NICE"
    sourceUrl: string                // link to the primary source document
    lastRefreshed: string            // ISO datetime when the record was last fetched
    sourceCoverage: 'high' | 'medium' | 'low'  // fraction of watched competitors with data
    dataFreshness:  'high' | 'medium' | 'low'  // age of the underlying source
    // inferenceDepth removed — not applicable for deterministic transformers (Phase 3 Light)
  }

  // ── Enrichment ───────────────────────────────────────────────────────────────
  // All enrichment fields are present-or-null. A null value collapses the field
  // silently; it never triggers a different card layout.
  whyItMatters:         string | null  // deterministic event-class line (no AI)
  dealValue:            string | null  // "$874M" extracted from filing text, or null
  agencyOutcome:        string | null  // "Approved" / "Rejected" / "Under review"
  attendingCompetitors: string[] | null  // for conference / earnings cards
}
