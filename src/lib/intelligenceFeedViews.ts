/**
 * intelligenceFeedViews.ts — Intelligence Feed V1 semantic-integrity
 * checkpoint (2026-08-25, report sections 3-7).
 *
 * Pure functions over the SAME scoped LandscapeSignal universe Intelligence
 * Feed's RecentSignalsStrip already renders (fetchLandscapeSignals()) --
 * never a second evidence store, never a client-side re-fetch, never AI.
 * Extracted to lib/ for the same reason as upcomingEvents.ts/
 * marketWeatherPresentation.ts this same engagement already established:
 * pure functions + a dedicated .test.ts, no DOM testing library.
 */
import type { LandscapeSignal, LandscapeSignalType } from './api/landscapeSignals'

// Report section 5: "Events should include concrete dated competitive
// events such as: [...]". Includes the three CT.gov change-detection types
// ("genuine trial status/phase changes") plus every explicit source-event/
// Company-PR type the task names -- never a new taxonomy, this IS
// signals.py's own normalized signal_type vocabulary.
export const EVENT_SIGNAL_TYPES: ReadonlySet<LandscapeSignalType> = new Set<LandscapeSignalType>([
  'TRIAL_FIRST_POSTED', 'RESULTS_FIRST_POSTED', 'PRIMARY_COMPLETION_REACHED', 'TRIAL_COMPLETED',
  'CLINICAL_TRIAL_STATUS_CHANGE', 'CLINICAL_TRIAL_PHASE_CHANGE', 'CLINICAL_TRIAL_COMPLETION_OR_TERMINATION',
  'CLINICAL_RESULTS', 'CLINICAL_MILESTONE',
  'REGULATORY_SUBMISSION', 'REGULATORY_ACCEPTANCE', 'REGULATORY_APPROVAL', 'REGULATORY_DECISION',
  'COMMERCIAL_LAUNCH', 'PROGRAM_DISCONTINUATION', 'PARTNERSHIP_OR_LICENSE',
])

export function filterEventSignals(signals: LandscapeSignal[]): LandscapeSignal[] {
  return signals.filter((s) => EVENT_SIGNAL_TYPES.has(s.signalType))
}

// Intelligence Feed repair (2026-08-27, report section 6): the previous
// MARKET_DEVELOPMENT_SIGNAL_TYPES taxonomy (PARTNERSHIP_OR_LICENSE,
// ACQUISITION_OR_MERGER, CORPORATE_STRATEGY_CHANGE, PROGRAM_DISCONTINUATION,
// COMMERCIAL_LAUNCH) never once matched the real backend signal_type
// vocabulary (confirmed via live DB query: only CLINICAL_RESULTS,
// INDICATION_EXPANSION, MATERIAL_CLINICAL_EVIDENCE_PUBLICATION,
// PRIMARY_COMPLETION_REACHED, REGULATORY_APPROVAL, RESULTS_FIRST_POSTED,
// TRIAL_COMPLETED, TRIAL_FIRST_POSTED are ever produced) -- Market
// Developments was therefore structurally always empty, regardless of how
// healthy the underlying landscape's evidence actually was.
//
// Replaced with a (signalType, sourceType) eligibility rule keyed to what a
// Market Development actually means ("what regulatory or commercial moves
// matter?"), using only the six V1 sources' own real guarantees:
//  - company_disclosure / sec_edgar: ALWAYS eligible. record_company_pr_evidence()
//    on the backend only ever persists a company_disclosure Signal once
//    Groq/Gemini's own semantic interpretation already classified the source
//    text MATERIAL_EVENT (see company_pr_interpretation.py) -- that upstream
//    materiality gate means no further signalType filtering is needed, or
//    safe to add on top, for either source.
//  - fda_drugs_at_fda / ema_epar: eligible only for the regulatory-decision
//    subset of signalType. An ordinary CT.gov trial-lifecycle event or a
//    PubMed publication is never promoted here just to populate the tab --
//    ineligible sources/types produce false, never a fabricated placeholder.
const MARKET_DEVELOPMENT_REGULATORY_TYPES: ReadonlySet<LandscapeSignalType> = new Set<LandscapeSignalType>([
  'REGULATORY_APPROVAL', 'REGULATORY_DECISION', 'REGULATORY_SUBMISSION', 'REGULATORY_ACCEPTANCE', 'INDICATION_EXPANSION',
])

export function isMarketDevelopmentSignal(signal: LandscapeSignal): boolean {
  if (signal.sourceType === 'company_disclosure' || signal.sourceType === 'sec_edgar') return true
  if (signal.sourceType === 'fda_drugs_at_fda' || signal.sourceType === 'ema_epar') {
    return MARKET_DEVELOPMENT_REGULATORY_TYPES.has(signal.signalType)
  }
  return false
}

export function filterMarketDevelopmentSignals(signals: LandscapeSignal[]): LandscapeSignal[] {
  return signals.filter(isMarketDevelopmentSignal)
}

// Report section 4: Leadership is NOT a second evidence store -- a narrower
// presentation of the SAME scoped Signal universe. A Signal's own factual
// fields (title/date/source/evidence) never change between views; only
// which Signals are shown does. HIGH importance is the one existing
// deterministic field this checkpoint uses ("Use deterministic existing
// fields wherever possible... importance/severity" / "Leadership may be a
// high-priority subset of Default if that is the smallest correct
// semantics") -- no new Groq pipeline, no expect/surprise fabrication (the
// historical product's EventAnnotation.expect/.surprise concept has no
// grounded V1 implementation for Signals and is not reproduced here).
export function filterLeadershipSignals(signals: LandscapeSignal[]): LandscapeSignal[] {
  return signals.filter((s) => s.importance === 'HIGH')
}
