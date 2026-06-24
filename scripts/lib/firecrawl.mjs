/**
 * scripts/lib/firecrawl.mjs — thin wrapper around the Firecrawl v2 REST API.
 *
 * Supports:
 *   - markdown mode  (formats: ['markdown'])  — plain scraped text
 *   - extract mode   (formats: ['extract'])   — LLM-structured JSON from a schema
 *
 * Usage:
 *   import { fcScrape } from './lib/firecrawl.mjs'
 *
 *   // Plain markdown
 *   const { markdown } = await fcScrape(url)
 *
 *   // Structured extraction
 *   const { extract } = await fcScrape(url, { schema: MY_SCHEMA, prompt: 'Extract...' })
 *
 * Env: FIRECRAWL_API_KEY (fc-...)
 */

const FIRECRAWL_API = 'https://api.firecrawl.dev/v2'

function getKey() {
  const k = process.env.FIRECRAWL_API_KEY
  if (!k) throw new Error('Missing FIRECRAWL_API_KEY — add it to .env.local')
  return k
}

/**
 * @param {string} url
 * @param {object} opts
 * @param {object|null} opts.schema   JSON Schema for structured extraction
 * @param {string}      opts.prompt   Extraction hint (used with schema)
 * @param {boolean}     opts.markdown Force include raw markdown alongside extract
 * @param {number}      opts.retries  Retry attempts on transient errors (default 2)
 * @returns {Promise<{markdown:string|null, extract:object|null, creditsUsed:number|null}>}
 */
export async function fcScrape(url, { schema = null, prompt = '', retries = 2 } = {}) {
  const key     = getKey()
  // v2 API: structured extraction uses format OBJECTS; plain scrapes use strings.
  // We always request markdown alongside extraction so callers can cross-validate
  // extracted titles against real page content and reject LLM hallucinations.
  const formats = schema
    ? [{ type: 'json', schema, ...(prompt ? { prompt } : {}) }, 'markdown']
    : ['markdown']

  const body = { url, formats }

  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const ms = 2000 * attempt
      console.log(`  Firecrawl: retrying in ${ms / 1000}s (attempt ${attempt + 1}/${retries + 1})…`)
      await new Promise(r => setTimeout(r, ms))
    }

    let res
    try {
      res = await fetch(`${FIRECRAWL_API}/scrape`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
    } catch (err) {
      lastErr = new Error(`Firecrawl network error: ${err.message}`)
      continue
    }

    const text = await res.text()
    if (!res.ok) {
      lastErr = new Error(`Firecrawl HTTP ${res.status}: ${text.slice(0, 300)}`)
      continue
    }

    let json
    try { json = JSON.parse(text) } catch { lastErr = new Error(`Firecrawl: non-JSON response`); continue }

    if (!json.success) {
      lastErr = new Error(`Firecrawl failed: ${json.error ?? text.slice(0, 200)}`)
      continue
    }

    const data        = json.data ?? {}
    const creditsUsed = data.metadata?.creditsUsed ?? json.creditsUsed ?? null
    if (creditsUsed != null) console.log(`  Firecrawl: ${creditsUsed} credits used (${url.slice(0, 80)})`)

    return {
      markdown:    data.markdown ?? null,
      // v2 returns structured output under data.json (fall back to legacy keys)
      extract:     data.json ?? data.extract ?? null,
      creditsUsed,
    }
  }

  throw lastErr
}
