/**
 * Name: extractWhy
 * Description: Phase 2 — WHY Rationale extraction module.
 *   Deterministic keyword-based extraction for why_it_matters. No external API calls.
 *   Zero cost — runs entirely from regex + template logic.
 *
 *   Strategy (in priority order):
 *     1. Deterministic regex  — HAE Phase 3, pivotal milestones, deals, senior execs
 *     2. Signal-type template — generic fallback per signal_type
 *
 * Usage:
 *   import { buildWhyItMatters } from './lib/extractWhy.mjs'
 *   const why = buildWhyItMatters(signal, competitorName, { assetName, indication })
 */

// ── Keyword patterns ──────────────────────────────────────────────────────────

/** Pivotal regulatory/clinical milestones */
const CLINICAL_HIGH_RE = /phase\s+[23]\s+(?:result|data|trial|study)\b|phase\s+iii\b|topline\b|top-line\b|primary\s+endpoint\s+met|fda\s+approv|nda\s+(?:accept|approv|submit)|ema\s+approv|maa\s+submit|pdufa/i

/** HAE-specific lexicon — INNs and TA terms */
const HAE_RE = /hereditary\s+angioedema|\bhae\b|bradykinin|kallikrein|c1[\s-]inhibitor|c1-inh|\bhaelo\b|berotralstat|navenibart|garadacimab|lonvoguran|ziclumeran|donidalorsen|deucrictibant|lanadelumab|icatibant|mezagitamab|orladeyo|takhzyro|firazyr|dawnzera|andembry/i

/** Commercial signals */
const COMMERCIAL_RE = /(?:net\s+)?revenue|commercial\s+launch|market\s+share|prescription\s+(?:growth|volume)|full[\s-]year\s+(?:guidance|outlook)/i

/** Hard deal language */
const DEAL_HARD_RE = /loan\s+agreement|credit\s+facilit|merger|acquisition|acquir|tender\s+offer|definitive\s+agreement|asset\s+purchase|strategic\s+transaction/i

/** Senior executive titles */
const SENIOR_EXEC_RE = /\b(?:chief\s+executive|chief\s+financial|chief\s+medical|chief\s+scientific|chief\s+commercial|president\s+(?:and|&)\s+ceo|ceo|cfo|cmo|cso|cco)\b/i

// ── HTML entity decoder ───────────────────────────────────────────────────────

function decodeEntities(str) {
  return (str ?? '')
    .replace(/&#(\d+);/g,    (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#8220;|&ldquo;/g, '"').replace(/&#8221;|&rdquo;/g, '"')
    .replace(/&#8217;|&rsquo;/g,  "'")
    .replace(/&#x2013;|&#8211;/g, '–').replace(/&#x2014;|&#8212;/g, '—')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
}

// ── 1. Deterministic classifier ───────────────────────────────────────────────

function tryDeterministic(signal, competitorName, assetName, indication) {
  const raw = decodeEntities(`${signal.headline ?? ''} ${signal.body_excerpt ?? ''}`)

  // Deals: always flag — legal prose signals strategic intent regardless of content
  if (signal.signal_type === 'deal' || DEAL_HARD_RE.test(raw)) {
    return `${competitorName} is making a strategic move — watch for pipeline or commercial implications in ${indication}.`
  }

  // HAE Phase 3 / pivotal readout — highest competitive priority
  if (CLINICAL_HIGH_RE.test(raw) && HAE_RE.test(raw)) {
    return `HAE Phase 3 data from ${competitorName} — assess relative positioning versus ${assetName} on efficacy and safety.`
  }

  // Non-HAE pivotal clinical milestone
  if (CLINICAL_HIGH_RE.test(raw)) {
    return `Clinical milestone at ${competitorName} — assess relative positioning versus ${assetName} on efficacy and safety.`
  }

  // HAE-relevant disclosure without pivotal data
  if (HAE_RE.test(raw)) {
    return `${competitorName} filed an HAE-relevant disclosure — review for pipeline or positioning implications.`
  }

  // Commercial performance signal
  if (COMMERCIAL_RE.test(raw)) {
    return `${competitorName} is signalling commercial performance or launch momentum — review for market share implications.`
  }

  // Senior executive departure or appointment
  if (signal.signal_type === 'exec_change' && SENIOR_EXEC_RE.test(raw)) {
    return `Senior leadership change at ${competitorName} — often precedes commercial or strategic pivots. Monitor upcoming messaging and field activity.`
  }

  return null
}

// ── 2. Template fallback ──────────────────────────────────────────────────────

function templateFallback(signal, competitorName, indication) {
  switch (signal.signal_type) {
    case 'deal':
      return `${competitorName} is making a strategic move — watch for pipeline or commercial implications in ${indication}.`
    case 'exec_change':
      return `Leadership change at ${competitorName} — often precedes commercial or strategic pivots. Monitor upcoming messaging and field activity.`
    case 'press_release':
      return `${competitorName} filed a public disclosure — review for competitive implications relevant to ${indication}.`
    default:
      return `${competitorName} filed a regulatory or corporate disclosure — monitor for follow-up.`
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Build the why_it_matters string for a company_signals row.
 *
 * Deterministic only — no external API calls. Called at ingest time by
 * run-sec-deals.mjs. Result stored in company_signals.why_it_matters.
 * UI reads from the DB column — never re-generates at render time.
 *
 * @param {object} signal         - { headline, body_excerpt, signal_type }
 * @param {string} competitorName - Display name of the competitor
 * @param {object} [opts]
 * @param {string} [opts.assetName='sebetralstat']
 * @param {string} [opts.indication='hereditary angioedema']
 * @returns {string}
 */
export function buildWhyItMatters(
  signal,
  competitorName,
  { assetName = 'sebetralstat', indication = 'hereditary angioedema' } = {},
) {
  return (
    tryDeterministic(signal, competitorName, assetName, indication) ??
    templateFallback(signal, competitorName, indication)
  )
}
