/**
 * Name: extractWhy
 * Description: Phase 2 — WHY Rationale extraction module.
 *   Extraction-first + ingest-time LLM (Claude Haiku) for why_it_matters.
 *
 *   Strategy (in priority order):
 *     1. Deterministic regex  — covers ~60-70% of signals (zero cost)
 *     2. Claude Haiku via API — covers residual ~30-40% (requires ANTHROPIC_API_KEY in env)
 *     3. Template fallback    — when no key or LLM call fails
 *
 * Usage:
 *   import { buildWhyItMatters } from './lib/extractWhy.mjs'
 *   const why = await buildWhyItMatters(signal, competitorName, { assetName, indication })
 *
 * Env: ANTHROPIC_API_KEY — add to .env.local to enable LLM enrichment.
 *   e.g. ANTHROPIC_API_KEY=sk-ant-...
 *   Without this key the module silently falls back to deterministic + template logic.
 */

// ── Keyword patterns ──────────────────────────────────────────────────────────

/** Pivotal regulatory/clinical milestones — always high-priority deterministic match */
const CLINICAL_HIGH_RE = /phase\s+[23]\s+(?:result|data|trial|study)\b|phase\s+iii\b|topline\b|top-line\b|primary\s+endpoint\s+met|fda\s+approv|nda\s+(?:accept|approv|submit)|ema\s+approv|maa\s+submit|pdufa/i

/** Any clinical activity — lower confidence */
const CLINICAL_RE = /\bphase\s+[123]\b|clinical\s+trial|efficacy|endpoint|advisory\s+committee/i

/** HAE-specific lexicon — INNs and TA terms */
const HAE_RE = /hereditary\s+angioedema|\bhae\b|bradykinin|kallikrein|c1[\s-]inhibitor|c1-inh|\bhaelo\b|berotralstat|navenibart|garadacimab|lonvoguran|ziclumeran|donidalorsen|deucrictibant|lanadelumab|icatibant|mezagitamab|orladeyo|takhzyro|firazyr|dawnzera|andembry/i

/** Commercial signals */
const COMMERCIAL_RE = /(?:net\s+)?revenue|commercial\s+launch|market\s+share|prescription\s+(?:growth|volume)|full[\s-]year\s+(?:guidance|outlook)/i

/** Hard deal language (Loan Agreement, M&A, etc.) */
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

// ── Excerpt cleaning ──────────────────────────────────────────────────────────

/**
 * Strip the EX-99.1 exhibit header that appears in 6-K press release filings.
 * Pattern: "EX-99.1 2 phvs-ex99_1.htm EX-99.1 EX-99.1 Exhibit 99.1 <content>"
 * The real prose starts after this metadata block.
 */
function stripEx99Prefix(s) {
  return s.replace(
    /^(?:EX-[\d.]+\s+\d+\s+\S+\.htm\s+)?(?:EX-[\d.]+\s+)*(?:Exhibit\s+\d+(?:\.\d+)?\s+)?/i,
    '',
  ).trim()
}

/**
 * Prepare a clean, concise excerpt for the LLM prompt.
 * Returns an empty string when there's nothing useful to send.
 */
function cleanForLLM(signal) {
  const headline = stripEx99Prefix(decodeEntities(signal.headline ?? ''))
  const body     = stripEx99Prefix(decodeEntities(signal.body_excerpt ?? ''))

  // Merge: prefer a composite that starts with the headline when it's distinct
  const composite = headline && !body.startsWith(headline.slice(0, 40))
    ? `${headline}\n${body}`
    : body || headline

  return composite.trim().slice(0, 600)
}

// ── 1. Deterministic classifier ───────────────────────────────────────────────

function tryDeterministic(signal, competitorName, assetName, indication) {
  const raw  = decodeEntities(`${signal.headline ?? ''} ${signal.body_excerpt ?? ''}`)

  // Deals: legal prose too dense for Haiku to reliably extract insight
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

  // Senior executive departure or appointment
  if (signal.signal_type === 'exec_change' && SENIOR_EXEC_RE.test(raw)) {
    return `Senior leadership change at ${competitorName} — often precedes commercial or strategic pivots. Monitor upcoming messaging and field activity.`
  }

  // No deterministic match — route to LLM
  return null
}

// ── 2. LLM enrichment (Claude Haiku) ─────────────────────────────────────────

async function tryLLM(signal, competitorName, indication) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null

  const excerpt = cleanForLLM(signal)
  if (!excerpt || excerpt.length < 20) return null

  const prompt =
    `Competitor: ${competitorName}. Indication tracked: ${indication}.\n\n` +
    `SEC filing excerpt:\n${excerpt}\n\n` +
    `Write one sentence (max 25 words) stating why this filing matters for ${indication} competitive intelligence. ` +
    `State the strategic implication directly. No preamble. No hedging. Use only facts from the excerpt.`

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body:   JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 100,
        messages:   [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    const text = data?.content?.[0]?.text?.trim()
    return (text && text.length > 10) ? text : null
  } catch (e) {
    process.stderr.write(`  [extractWhy] LLM call failed for ${competitorName}: ${e.message}\n`)
    return null
  }
}

// ── 3. Template fallback ──────────────────────────────────────────────────────

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
 * Called at ingest time by run-sec-deals.mjs. Result is stored in
 * company_signals.why_it_matters. The UI reads from the DB column —
 * never re-generates at render time.
 *
 * @param {object} signal         - { headline, body_excerpt, signal_type }
 * @param {string} competitorName - Display name of the competitor
 * @param {object} [opts]
 * @param {string} [opts.assetName='sebetralstat']
 * @param {string} [opts.indication='hereditary angioedema']
 * @returns {Promise<string>}
 */
export async function buildWhyItMatters(
  signal,
  competitorName,
  { assetName = 'sebetralstat', indication = 'hereditary angioedema' } = {},
) {
  const deterministic = tryDeterministic(signal, competitorName, assetName, indication)
  if (deterministic) return deterministic

  const llm = await tryLLM(signal, competitorName, indication)
  if (llm) return llm

  return templateFallback(signal, competitorName, indication)
}
