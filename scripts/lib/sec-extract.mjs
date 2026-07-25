/**
 * scripts/lib/sec-extract.mjs — shared SEC disclosure extraction (§2.4).
 *
 * Extracts the REAL first-sentence disclosure from an SEC filing (8-K body, then
 * the EX-99.1 press-release exhibit) — never synthesizes a headline. Used by both
 * the go-forward ingest (run-sec-deals.mjs) and the one-time cleanup
 * (reprocess-sec-headlines.mjs) so the two agree.
 */

import { qualityGate } from './signal-gate.mjs'

const SEC_USER_AGENT = 'AriyaSignals ayat.tayebulla@phamax.ch'
const TIMEOUT_MS     = 20_000
const EXCERPT_LEN    = 500
const RATE_MS        = 150

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

export function stripHtml(html) {
  return html
    .replace(/<ix:hidden[\s\S]*?<\/ix:hidden>/gi, '')
    .replace(/<dei:[^>]*>[\s\S]*?<\/dei:[^>]*>/gi, '')
    .replace(/<xbrli?:[^>]*>[\s\S]*?<\/xbrli?:[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#160;/g, ' ')
    .replace(/&#8220;/g, '"').replace(/&#8221;/g, '"').replace(/&#8217;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

export async function fetchText(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': SEC_USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    return r.ok ? r.text() : null
  } catch { return null }
}

const ITEM_TITLE = new RegExp(
  '^(?:Other Events|Results of Operations and Financial Condition|Results of Operations|' +
  'Entry into a Material Definitive Agreement|Completion of Acquisition or Disposition of Assets|' +
  'Departure of Directors or Certain Officers[^.]*|Election of Directors[^.]*|' +
  'Appointment of Certain Officers[^.]*|Regulation FD Disclosure|' +
  'Financial Statements and Exhibits|Compensatory Arrangements[^.]*)[.\\s:]*', 'i',
)

// Sentence end = [.!?] + space/end, NOT preceded by a known abbreviation.
const SENTENCE = new RegExp(
  '^[A-Z0-9"][\\s\\S]{25,240}?' +
  '(?<!\\b(?:Inc|Corp|Ltd|Co|LLC|plc|U\\.S|Dr|Mr|Mrs|Ms|Jr|Sr|St|No|vs|' +
  'Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec))[.!?](?=\\s|$)',
)

export function extractDisclosure(text, itemCode) {
  const marker = new RegExp(`Item\\s*${itemCode.replace('.', '\\.')}`, 'gi')
  let last = -1, m
  while ((m = marker.exec(text)) !== null) last = m.index + m[0].length
  if (last === -1) return null
  const body = text.slice(last).replace(/^[.\s:—-]+/, '').replace(ITEM_TITLE, '').trim()
  const sent = body.match(SENTENCE)
  if (!sent) return null
  return {
    headline: sent[0].replace(/\s+/g, ' ').trim(),
    body: body.slice(0, EXCERPT_LEN).replace(/\s+/g, ' ').trim(),
  }
}

const EXHIBIT_REF = /attached as Exhibit 99|furnished as Exhibit 99|copy of the (?:press release|presentation)|is incorporated (?:herein )?by reference/i

function parseSecUrl(url) {
  const m = (url ?? '').match(/edgar\/data\/(\d+)\/(\d+)\//)
  return m ? { unpadded: m[1], accNodash: m[2] } : null
}

const dashAccession = (a) => `${a.slice(0, 10)}-${a.slice(10, 12)}-${a.slice(12)}`

async function fetchEx99Url(unpadded, accNodash) {
  const indexUrl = `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${dashAccession(accNodash)}-index.htm`
  const html = await fetchText(indexUrl)
  if (!html) return null
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let match
  while ((match = rowRegex.exec(html)) !== null) {
    if (!/EX-99/i.test(match[1])) continue
    const href = match[1].match(/href="([^"#]+\.htm[l]?)"/i)
    if (href) {
      const f = href[1]
      return f.startsWith('http') ? f
        : `https://www.sec.gov/Archives/edgar/data/${unpadded}/${accNodash}/${f.replace(/^.*\//, '')}`
    }
  }
  return null
}

function stripExhibitHeader(t) {
  return t.replace(
    /^(?:\s*(?:EX-99[.\d]*|Exhibit\s+99[.\d]*|PRESS RELEASE|EdgarFiling|FINAL|[A-Za-z0-9_.-]+\.html?|\d+))+\s*/i,
    '',
  ).trim()
}

function extractPressRelease(raw) {
  const text = stripExhibitHeader(raw)
  const dateline = text.search(/\([A-Z][A-Za-z ]+WIRE\)|\b[A-Z]{2,}[A-Za-z.]*,\s+[A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4}|\s--\s/)
  if (dateline > 20 && dateline < 220) {
    const title = text.slice(0, dateline).replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '')
    if (title.length >= 20 && qualityGate(title).ok) return title
  }
  const sent = text.match(SENTENCE)
  return sent ? sent[0].replace(/\s+/g, ' ').trim() : null
}

/**
 * Recover a real, gate-passing disclosure for a filing, or null.
 * Tries the 8-K body first; if it is missing or only points at the exhibit,
 * fetches the EX-99.1 press release. Rate-limits its own SEC requests.
 *
 * @returns {Promise<{ headline: string, body: string } | null>}
 */
export async function recoverDisclosure(sourceUrl, items, signalType) {
  if (!sourceUrl) return null
  const html = await fetchText(sourceUrl)
  await sleep(RATE_MS)
  let recovered = null
  if (html) {
    const text = stripHtml(html)
    const declared = (items ?? '').split(',').map(s => s.trim())
      .find(x => ['1.01', '2.01', '5.02', '8.01', '7.01'].includes(x))
    const byType = { exec_change: '5.02', deal: '1.01', press_release: '8.01', regulatory_catalyst: '8.01' }[signalType]
    const candidates = [...new Set([declared, byType, '8.01', '5.02', '1.01', '2.01', '7.01'].filter(Boolean))]
    for (const item of candidates) {
      const r = extractDisclosure(text, item)
      if (r && qualityGate(r.headline).ok) { recovered = r; break }
    }
  }
  if (!recovered || EXHIBIT_REF.test(recovered.headline)) {
    const p = parseSecUrl(sourceUrl)
    if (p) {
      const ex99Url = await fetchEx99Url(p.unpadded, p.accNodash)
      await sleep(RATE_MS)
      if (ex99Url) {
        const exHtml = await fetchText(ex99Url)
        await sleep(RATE_MS)
        if (exHtml) {
          const exText = stripHtml(exHtml)
          const prHeadline = extractPressRelease(exText)
          if (prHeadline && qualityGate(prHeadline).ok) {
            recovered = { headline: prHeadline, body: stripExhibitHeader(exText).slice(0, EXCERPT_LEN).replace(/\s+/g, ' ').trim() }
          }
        }
      }
    }
  }
  return recovered && qualityGate(recovered.headline).ok ? recovered : null
}
