/**
 * buildMarketImplications — LLM-based Market Weather implications (local Ollama).
 *
 * Replaces the deployed Supabase Edge Function `market-weather-refresh`
 * (supabase/functions/market-weather-refresh, source not tracked in this
 * repo), which called Groq and upserted into `market_weather_snapshots` --
 * a table nothing in src/ reads. The War Room's "Market weather" panel
 * reads `market_intelligence` instead (see src/lib/db/index.ts
 * getMarketImplications). Groq also can't be swapped for local Ollama in
 * that function anyway: Ollama is a localhost-only server, unreachable from
 * Supabase's cloud Edge Runtime -- so this generation has to happen from a
 * script run on a machine with Ollama running, same as buildCleanHeadline.mjs.
 *
 * Generate -> judge -> retry-once -> judge again, same shape as the original
 * Groq pipeline's quality gate (enrichSignal.ts's runPipeline). Added after
 * a live run produced a bullet that conflated the TRACKED ASSET's own
 * cardiovascular data with the COMPETITOR's -- the judge's #1 criterion
 * (ATTRIBUTION) exists specifically to catch that failure mode, not just
 * generic "is this grounded" checking.
 *
 * Uses the local Ollama install already set up for this repo (no hosted
 * API, no per-call cost) -- see .env.local's OLLAMA_HOST/OLLAMA_MODEL.
 *
 * Returns { bullets: [], rejected: [] } (never a guess) when there isn't
 * enough recent signal to ground real implications.
 */

const OLLAMA_HOST  = process.env.OLLAMA_HOST  ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1'
const TIMEOUT_MS    = 240_000 // larger prompt than buildCleanHeadline (up to 30 signals) -- local 8B needs more headroom

const MIN_SIGNALS = 5
const MAX_BULLETS = 3

async function callOllama(system, prompt, temperature) {
  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system,
      prompt,
      stream: false,
      options: { temperature },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)
  const { response } = await res.json()
  return (response ?? '').trim()
}

function formatCompetitorName(id) {
  if (!id) return 'Unknown competitor'
  return id.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function buildSignalsText(signals, nameById) {
  return signals.map(s => {
    const sev = s.ai_severity ?? 'UNKNOWN'
    const comp = nameById[s.competitor_id] ?? formatCompetitorName(s.competitor_id)
    const detail = (s.why_it_matters ?? s.body_excerpt ?? '').slice(0, 160)
    return `[${sev}] ${comp} — ${s.headline ?? ''}${detail ? `: ${detail}` : ''}`
  }).join('\n')
}

// ── Stage 1: Generate ─────────────────────────────────────────────────────────

const GENERATE_SYSTEM = `You are a pharmaceutical competitive intelligence analyst. You write short strategic-implication bullets for a "Market weather" panel read by a team bringing their own asset to market.

Given a list of recent competitive signals (HIGH/MEDIUM severity, most recent 90 days), write up to ${MAX_BULLETS} short strategic implications -- each one sentence, max 35 words, grounded ONLY in the signals provided.

Rules for each bullet:
- Name the specific competitor(s) and event driving the implication.
- State the strategic implication for the tracked asset's team, not a recap of the news itself.
- Keep facts about the TRACKED ASSET and facts about each COMPETITOR strictly separate -- never attribute the tracked asset's own data, trial results, or safety profile to a competitor, or vice versa.
- Never invent facts, figures, dates, or outcomes not present in the signals.
- No promotional language, no claims about the tracked asset's superiority.
- If an inference isn't explicitly stated in a signal, hedge it ("plausibly", "suggests", "may indicate").
- Only write a bullet if the signals genuinely support a concrete, specific implication -- fewer good bullets beats padding with a generic one.

Respond with each bullet on its own line, nothing else -- no numbering, no markdown, no preamble.
If the signals don't support ANY concrete implication, respond with exactly: NONE`

function buildGenerateUser(assetConfig, signalsText, signalCount) {
  return [
    `TRACKED ASSET: ${assetConfig.assetName} (${assetConfig.assetModality}) for ${assetConfig.diseaseArea}`,
    `ANALYSIS WINDOW: last 90 days (${signalCount} HIGH/MEDIUM signals)`,
    '',
    'COMPETITIVE SIGNALS:',
    signalsText,
  ].join('\n')
}

function parseBullets(text) {
  if (!text || text.toUpperCase() === 'NONE') return []
  return text
    .split('\n')
    .map(line => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, MAX_BULLETS)
}

// ── Stage 2: Judge ────────────────────────────────────────────────────────────

const JUDGE_SYSTEM = `You are a strict quality reviewer for a pharmaceutical competitive-intelligence platform. You check AI-generated strategic-implication bullets before they are shown to analysts making brand decisions.

Evaluate the bullet against THREE criteria, using ONLY the competitive signals provided:

1. GROUNDED: Every factual claim in the bullet is directly supported by the signals. Trial phases, results, filings, dates, and events must appear in the signal text -- not general industry knowledge.

2. ATTRIBUTION: The single most important check. The bullet names a competitor and discusses facts about them -- verify those facts are actually about THAT competitor in the signals, not about the tracked asset. A bullet that attributes the tracked asset's own data, trial results, or safety profile to the competitor (or vice versa) FAILS this criterion, even if every individual fact is separately true somewhere in the signals.

3. HEDGED: Any inference not explicitly stated in the signals (e.g. "may indicate", "plausibly", "suggests") is clearly hedged, not presented as established fact.

Respond in EXACTLY this format:
VERDICT: PASS or FAIL
REASON: [one sentence naming the specific issue -- which claim is ungrounded, which fact is misattributed to the wrong company, or which inference is unhedged. Write "N/A" if PASS.]`

function buildJudgeUser(assetName, bullet, signalsText) {
  return [
    `TRACKED ASSET: ${assetName}`,
    '',
    'SIGNALS:',
    signalsText,
    '',
    'BULLET TO REVIEW:',
    bullet,
  ].join('\n')
}

function parseVerdict(text) {
  const verdictMatch = text.match(/VERDICT:\s*(PASS|FAIL)/i)
  const reasonMatch = text.match(/REASON:\s*(.+)/i)
  return {
    pass: verdictMatch?.[1]?.toUpperCase() === 'PASS',
    reason: reasonMatch?.[1]?.trim() ?? 'No reason given',
  }
}

async function judgeBullet(bullet, signalsText, assetConfig) {
  const raw = await callOllama(JUDGE_SYSTEM, buildJudgeUser(assetConfig.assetName, bullet, signalsText), 0)
  return parseVerdict(raw)
}

// ── Stage 3: Regenerate-once on FAIL ──────────────────────────────────────────

const REGENERATE_SYSTEM = `You are a pharmaceutical competitive intelligence analyst correcting one rejected strategic-implication bullet. Fix ONLY the specific issue named -- keep the rest of the bullet's substance if it's still valid. Respond with the single corrected bullet and nothing else (one sentence, max 35 words). If the issue can't be fixed while staying grounded in the signals, respond with exactly: NONE`

function buildRegenerateUser(assetConfig, signalsText, failedBullet, reason) {
  return [
    `TRACKED ASSET: ${assetConfig.assetName} (${assetConfig.assetModality}) for ${assetConfig.diseaseArea}`,
    '',
    'SIGNALS:',
    signalsText,
    '',
    `REJECTED BULLET: ${failedBullet}`,
    `REJECTION REASON: ${reason}`,
  ].join('\n')
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param {Array<{ competitor_id: string|null, headline: string|null, body_excerpt: string|null,
 *   why_it_matters: string|null, ai_severity: string|null }>} signals
 * @param {{ assetName: string, assetModality: string, diseaseArea: string }} assetConfig
 * @param {Record<string,string>} nameById competitor_id -> display name
 * @returns {Promise<{ bullets: string[], rejected: Array<{ bullet: string, reason: string, stage: string }> }>}
 */
export async function buildMarketImplications(signals, assetConfig, nameById) {
  if (signals.length < MIN_SIGNALS) return { bullets: [], rejected: [] }

  const signalsText = buildSignalsText(signals, nameById)
  const genText = await callOllama(GENERATE_SYSTEM, buildGenerateUser(assetConfig, signalsText, signals.length), 0.3)
  const candidates = parseBullets(genText)
  if (candidates.length === 0) return { bullets: [], rejected: [] }

  const bullets = []
  const rejected = []

  for (const candidate of candidates) {
    const verdict = await judgeBullet(candidate, signalsText, assetConfig)
    if (verdict.pass) { bullets.push(candidate); continue }

    const retryText = await callOllama(
      REGENERATE_SYSTEM,
      buildRegenerateUser(assetConfig, signalsText, candidate, verdict.reason),
      0.2,
    )
    const retryBullet = retryText.trim().replace(/^["']|["']$/g, '')
    if (!retryBullet || retryBullet.toUpperCase() === 'NONE') {
      rejected.push({ bullet: candidate, reason: verdict.reason, stage: 'initial (no retry attempted)' })
      continue
    }

    const reVerdict = await judgeBullet(retryBullet, signalsText, assetConfig)
    if (reVerdict.pass) {
      bullets.push(retryBullet)
    } else {
      rejected.push({ bullet: retryBullet, reason: `${verdict.reason} | retry: ${reVerdict.reason}`, stage: 'retry' })
    }
  }

  return { bullets: bullets.slice(0, MAX_BULLETS), rejected }
}
