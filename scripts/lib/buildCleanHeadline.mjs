/**
 * buildCleanHeadline — LLM-based headline cleanup (Round 2, R4).
 *
 * Unlike buildWhyItMatters (deterministic regex/template), a clean, natural
 * headline genuinely needs language judgment: deciding whether a raw
 * headline is already good prose vs. filing-metadata boilerplate, and
 * whether an excerpt has enough substance to synthesize from at all. Uses
 * the local Ollama install (no hosted API, no per-call cost) already set up
 * for this repo — see .env.local's OLLAMA_HOST/OLLAMA_MODEL.
 *
 * Returns null (never a guess) when there's no substantive content to work
 * from — e.g. pure SEC filing boilerplate/exhibit index text. The caller's
 * existing fallback chain (clean_headline ?? headline ?? 'Untitled signal')
 * already handles the null case correctly.
 */

const OLLAMA_HOST  = process.env.OLLAMA_HOST  ?? 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.1'
const TIMEOUT_MS    = 60_000

const SYSTEM_PROMPT = `You clean up headlines for a pharma competitive-intelligence signal feed. Given a raw headline and a source excerpt, decide:
- If the raw headline is already a clear, factual, readable title (e.g. a journal article or genuine press-release title), output it as-is, only fixing obvious HTML-entity or spacing artifacts. Do not rewrite or embellish it.
- If the raw headline is a generic filing placeholder (e.g. "SEC 6-K filing", "SEC 8-K filing") and the excerpt contains real, substantive news content, write ONE clean, factual, concise headline (max 20 words) using ONLY facts explicitly stated in the excerpt. Never invent, infer, or add any detail not present in the text.
- If neither the headline nor the excerpt contains substantive news content (only SEC filing boilerplate, exhibit filenames, form numbers, or a table of contents), respond with exactly: NONE

Respond with ONLY the headline text or the word NONE. No quotes, no explanation, no preamble.`

function buildUserPrompt(signal, competitorName) {
  return [
    `Competitor: ${competitorName}`,
    `Signal type: ${signal.signal_type ?? 'unknown'}`,
    `Raw headline: ${signal.headline ?? '(none)'}`,
    `Excerpt: ${(signal.body_excerpt ?? '').slice(0, 600) || '(none)'}`,
  ].join('\n')
}

/**
 * @param {{ signal_type: string|null, headline: string|null, body_excerpt: string|null }} signal
 * @param {string} competitorName
 * @returns {Promise<string|null>}
 */
export async function buildCleanHeadline(signal, competitorName) {
  if (!signal.headline && !signal.body_excerpt) return null

  const res = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(signal, competitorName),
      stream: false,
      options: { temperature: 0.1 },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`)

  const { response } = await res.json()
  const cleaned = (response ?? '').trim().replace(/^["']|["']$/g, '')
  if (!cleaned || cleaned.toUpperCase() === 'NONE') return null
  // Guard against the model echoing a refusal/preamble instead of a headline
  if (cleaned.length > 240) return null
  return cleaned
}
