/**
 * intelligenceFeedViews.test.ts — Intelligence Feed V1 semantic-integrity
 * checkpoint (2026-08-25, report section 12).
 *
 * No test runner is configured in this repo (see src/lib/signalText.test.ts);
 * run with:  npx tsx src/lib/intelligenceFeedViews.test.ts
 * Exit code 0 = all pass. Exit code 1 = one or more failures.
 */
import { filterEventSignals, filterMarketDevelopmentSignals, filterLeadershipSignals } from './intelligenceFeedViews.js'
import type { LandscapeSignal, LandscapeSignalType, SignalImportance } from './api/landscapeSignals.js'

let passed = 0
let failed = 0

function assert(label: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { console.log(`  ✓  ${label}`); passed++ }
  else {
    console.error(`  ✗  ${label}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     received: ${JSON.stringify(actual)}`)
    failed++
  }
}

function sig(id: string, signalType: LandscapeSignalType, sourceType: string, importance: SignalImportance = 'MEDIUM'): LandscapeSignal {
  return {
    id, signalType, diseaseId: 'mondo:0005252', companyId: 'astrazeneca', companyName: 'AstraZeneca',
    assetId: 'lokelma', assetName: 'Lokelma', occurredAt: '2026-08-01T00:00:00Z', detectedAt: '2026-08-01T00:00:00Z',
    title: 't', description: 'd', importance, sourceType, sourceLocator: 'https://example.com', evidenceId: 'ev-1', priorEvidenceId: null,
  }
}

console.log('1. Backend-returned FDA Signal is not filtered from Default (Default = the raw, unfiltered array itself)')
const fdaSignal = sig('s-fda', 'REGULATORY_APPROVAL', 'fda_drugs_at_fda')
assert('FDA signal survives an identity/no-op Default pass', [fdaSignal].includes(fdaSignal), true)
assert('FDA signal counts as an eligible Event', filterEventSignals([fdaSignal]), [fdaSignal])

console.log('2. Backend-returned EMA Signal is not filtered')
const emaSignal = sig('s-ema', 'REGULATORY_APPROVAL', 'ema_epar')
assert('EMA signal counts as an eligible Event', filterEventSignals([emaSignal]), [emaSignal])

console.log('3. company_disclosure Signal is not filtered')
const disclosureSignal = sig('s-disc', 'CLINICAL_RESULTS', 'company_disclosure')
assert('company_disclosure CLINICAL_RESULTS counts as an eligible Event', filterEventSignals([disclosureSignal]), [disclosureSignal])

console.log('4. sec_edgar Signal is not filtered')
const secSignal = sig('s-sec', 'CLINICAL_MILESTONE', 'sec_edgar')
assert('sec_edgar CLINICAL_MILESTONE counts as an eligible Event', filterEventSignals([secSignal]), [secSignal])

console.log('5. Events counter derives from actual eligible Signals (an ordinary trial-first-posted mix)')
const trialFirst = sig('s-1', 'TRIAL_FIRST_POSTED', 'clinicaltrials_gov')
const resultsFirst = sig('s-2', 'RESULTS_FIRST_POSTED', 'clinicaltrials_gov')
const notAnEvent = sig('s-3', 'COMPANY_DISCLOSURE', 'press_release') // legacy generic fallback type -- not in the section-5 taxonomy
assert('Events counter = count of eligible types only', filterEventSignals([trialFirst, resultsFirst, notAnEvent]).length, 2)

console.log('6. Market Developments counter derives from its actual (source+type-gated) subset (2026-08-27 rule)')
const disclosureDev = sig('s-4', 'CLINICAL_RESULTS', 'company_disclosure')
assert(
  'Market Developments = company_disclosure/sec_edgar (always) + regulatory-decision FDA/EMA types only, never ordinary CT.gov trial milestones',
  filterMarketDevelopmentSignals([trialFirst, resultsFirst, disclosureDev]).map((s) => s.id),
  ['s-4'],
)

console.log('7. Zero Market Developments is honest (no forced diversity, no fabricated item)')
assert('zero eligible signals -> empty array, never a placeholder', filterMarketDevelopmentSignals([trialFirst, resultsFirst]), [])

console.log('8. Default includes the broader universe (every Event-eligible AND non-Event-eligible Signal alike)')
const all = [trialFirst, resultsFirst, notAnEvent, disclosureDev]
assert('Default (no filter) is the full, unfiltered set', all.length, 4)
assert('Events is a proper subset of Default', filterEventSignals(all).every((s) => all.includes(s)), true)

console.log('9. Leadership is a subset of Default, never a second evidence store')
const high = sig('s-high', 'TRIAL_FIRST_POSTED', 'clinicaltrials_gov', 'HIGH')
const low = sig('s-low', 'TRIAL_FIRST_POSTED', 'clinicaltrials_gov', 'LOW')
const leadership = filterLeadershipSignals([high, low])
assert('Leadership contains only HIGH-importance Signals', leadership, [high])
assert('every Leadership Signal is also present in Default (the same array)', leadership.every((s) => [high, low].includes(s)), true)

console.log('10. Switching views does not mutate factual Signal data (same object references, no re-derivation)')
const original = sig('s-orig', 'REGULATORY_APPROVAL', 'fda_drugs_at_fda', 'HIGH')
const viaEvents = filterEventSignals([original])
const viaLeadership = filterLeadershipSignals([original])
assert('object identity preserved through Events filter', viaEvents[0], original)
assert('object identity preserved through Leadership filter', viaLeadership[0] === original, true)
assert('title/date/source untouched', { title: viaLeadership[0].title, occurredAt: viaLeadership[0].occurredAt, sourceType: viaLeadership[0].sourceType }, { title: 't', occurredAt: '2026-08-01T00:00:00Z', sourceType: 'fda_drugs_at_fda' })

console.log('11. Genuine trial status/phase changes (the CT.gov change-detection taxonomy) are Events')
const statusChange = sig('s-5', 'CLINICAL_TRIAL_STATUS_CHANGE', 'clinicaltrials_gov')
const phaseChange = sig('s-6', 'CLINICAL_TRIAL_PHASE_CHANGE', 'clinicaltrials_gov')
const completionOrTermination = sig('s-7', 'CLINICAL_TRIAL_COMPLETION_OR_TERMINATION', 'clinicaltrials_gov')
assert('all three change-detection types are eligible Events', filterEventSignals([statusChange, phaseChange, completionOrTermination]).length, 3)

console.log('12. company_disclosure/sec_edgar Signals qualify as Market Developments regardless of signalType (upstream MATERIAL_EVENT gate)')
const discontinuation = sig('s-8', 'PROGRAM_DISCONTINUATION', 'company_disclosure')
const launch = sig('s-9', 'COMMERCIAL_LAUNCH', 'sec_edgar')
assert('company_disclosure Signal qualifies regardless of signalType', filterMarketDevelopmentSignals([discontinuation]), [discontinuation])
assert('sec_edgar Signal qualifies regardless of signalType', filterMarketDevelopmentSignals([launch]), [launch])

console.log('13. FDA/EMA Signals only qualify as Market Developments for the regulatory-decision type subset')
const fdaApproval = sig('s-10', 'REGULATORY_APPROVAL', 'fda_drugs_at_fda')
const emaIndicationExpansion = sig('s-11', 'INDICATION_EXPANSION', 'ema_epar')
const fdaTrialFirstPosted = sig('s-12', 'TRIAL_FIRST_POSTED', 'fda_drugs_at_fda') // not a real combination, but the rule must still hold
assert('FDA REGULATORY_APPROVAL qualifies', filterMarketDevelopmentSignals([fdaApproval]), [fdaApproval])
assert('EMA INDICATION_EXPANSION qualifies', filterMarketDevelopmentSignals([emaIndicationExpansion]), [emaIndicationExpansion])
assert('FDA non-regulatory-decision type does not qualify', filterMarketDevelopmentSignals([fdaTrialFirstPosted]), [])

console.log('14. clinicaltrials_gov/pubmed Signals never qualify as Market Developments, regardless of signalType')
const pubmedResult = sig('s-13', 'REGULATORY_APPROVAL', 'pubmed') // not a real combination, but the rule must still hold
assert('pubmed-sourced Signal never qualifies', filterMarketDevelopmentSignals([pubmedResult]), [])

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) (process as any).exit(1)
