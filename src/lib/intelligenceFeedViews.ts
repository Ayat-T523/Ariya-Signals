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

// Report section 6: genuinely structural/market-changing types only --
// deliberately a SMALLER set than EVENT_SIGNAL_TYPES (every member here is
// also an Event; PARTNERSHIP_OR_LICENSE/PROGRAM_DISCONTINUATION/
// COMMERCIAL_LAUNCH belong to both by the task's own design -- Market
// Developments is a narrower highlight, not a disjoint category). Ordinary
// trial milestones (TRIAL_FIRST_POSTED etc.) are never promoted here just
// to populate the tab -- an honest zero is correct when none of these exist.
export const MARKET_DEVELOPMENT_SIGNAL_TYPES: ReadonlySet<LandscapeSignalType> = new Set<LandscapeSignalType>([
  'PARTNERSHIP_OR_LICENSE', 'ACQUISITION_OR_MERGER', 'CORPORATE_STRATEGY_CHANGE', 'PROGRAM_DISCONTINUATION', 'COMMERCIAL_LAUNCH',
])

export function filterEventSignals(signals: LandscapeSignal[]): LandscapeSignal[] {
  return signals.filter((s) => EVENT_SIGNAL_TYPES.has(s.signalType))
}

export function filterMarketDevelopmentSignals(signals: LandscapeSignal[]): LandscapeSignal[] {
  return signals.filter((s) => MARKET_DEVELOPMENT_SIGNAL_TYPES.has(s.signalType))
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
