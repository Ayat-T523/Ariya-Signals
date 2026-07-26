/**
 * signalType.ts — signal_type refinement for Deno edge functions (§4.1).
 *
 * MIRROR of the canonical implementation in scripts/lib/signal-gate.mjs.
 * Edge functions run in Deno and cannot import from scripts/, so this copy
 * exists deliberately. If you change one, change both — the two must agree or
 * the same press release will be typed differently depending on which ingest
 * path saw it first.
 *
 * signal_type decides the arc, and the arc decides importance (D11, §4.2), so a
 * mis-typed signal is mis-ranked. These rules classify WHAT AN EVENT IS from the
 * source's own words; they never judge how important it is.
 */

const REG_AUTHORITY =
  /\b(fda|food and drug administration|ema|european medicines agency|european commission|european union|chmp|mhra|pmda|health canada|swissmedic)\b/i

// Decision-grade actions only. Deliberately excludes "submitted", "filing" and
// "granted": "filing" matches SEC boilerplate, "granted" matches patents and
// stock-option grants.
const REG_DECISION =
  /\b(approv(?:e|ed|es|al)|authoris(?:e|ed)|authoriz(?:e|ed)|acceptance|accepted for (?:review|filing)|clearance|refus(?:al|ed)|positive opinion|negative opinion|marketing authoris(?:ation)|marketing authorization)\b/i

const REG_STRONG =
  /\b(pdufa|complete response letter|advisory committee|adcom|priority review|fast track designation|breakthrough therapy designation|orphan drug designation|chmp opinion)\b/i

// Mentions a regulator but is really something else: Paragraph IV/ANDA notice
// letters are patent challenges, licence and collaboration agreements are deals,
// Hart-Scott-Rodino clearance is an M&A step.
const REG_NOT_REALLY =
  /\b(paragraph iv|notice letter|abbreviated new drug application|hart-scott-rodino|licen[cs]e agreement|collaboration agreement)\b/i

const TRIAL_READOUT =
  /\b(phase\s*[123](?:\/[123])?\b[^.]{0,60}\b(?:result|results|data|readout)|topline (?:result|data)|primary endpoint (?:met|was met)|pivotal[^.]{0,30}result|completes enrollment|enrollment complete)\b/i

// Periodic or forward-looking announcements that merely mention trial data.
const NOT_A_READOUT =
  /\b(financial results|quarterly results|full year|fourth quarter|third quarter|second quarter|first quarter|annual report|strategic priorities|outlines \d{4}|to report|to present|will present|updates timing|announces timing)\b/i

const UNINFORMATIVE_HEADLINE =
  /^\s*(on \w+ \d{1,2},? \d{4}|as previously disclosed|the (?:full )?text of|a copy of)/i

const REFINABLE = new Set(['press_release', 'regulatory_catalyst'])

export function isRegulatoryEvent(text: string): boolean {
  const t = text ?? ''
  if (REG_NOT_REALLY.test(t)) return false
  if (REG_STRONG.test(t)) return true
  return REG_AUTHORITY.test(t) && REG_DECISION.test(t)
}

export function isTrialReadout(text: string): boolean {
  const t = text ?? ''
  if (NOT_A_READOUT.test(t)) return false
  return TRIAL_READOUT.test(t)
}

/**
 * The text that actually describes the event. The headline states what an
 * announcement is about; the body is consulted only when the headline says
 * nothing (truncated SEC filings).
 */
function subjectText(headline: string | null, body: string | null): string {
  const h = (headline ?? '').trim()
  if (!h || h.length < 25 || UNINFORMATIVE_HEADLINE.test(h)) {
    return `${h} ${body ?? ''}`
  }
  return h
}

/** Refine a company-announcement signal_type from its own words. */
export function refineSignalType(
  headline: string | null,
  bodyExcerpt: string | null,
  currentType: string,
): string {
  if (!REFINABLE.has(currentType)) return currentType
  const subject = subjectText(headline, bodyExcerpt)
  if (isTrialReadout(subject)) return 'trial_update'
  if (isRegulatoryEvent(subject)) return 'regulatory_catalyst'
  return currentType === 'regulatory_catalyst' ? 'press_release' : currentType
}
