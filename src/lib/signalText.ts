/**
 * Shared signal text cleaner — Phase 3A.
 *
 * Exports:
 *   isReadableProse(text)    — positive prose gate (no React / Supabase deps)
 *   cleanSignalText(signal)  — picks best field, decodes, strips, sentences
 *
 * Phase 3B wires this into useCompetitorSupabase and WarRoom.
 * Call sites are NOT changed here.
 */

// ── Negative patterns — high-confidence boilerplate ───────────────────────────
// Each catches a distinct family of SEC artefacts that would otherwise pass a
// naive word-count or alphabetic-ratio check.

/** U.S. SEC cover-page header — appears in 8-K, 10-K, and 6-K preambles. */
const SEC_PREAMBLE_RE = /SECURITIES AND EXCHANGE COMMISSION|WASHINGTON,?\s+D\.C\.\s+205/i

/**
 * Filing-document filename codes.
 * Matches: "form6k_060926.htm", "form6k-2_051326.htm", "form20q_", "form10k_"
 * Pattern: word-boundary + "form" + optional digits + "k" or "q" + "-" or "_" + digit
 */
const FORM_FILE_RE = /\bform\d*[kq][-_]\d/i

/**
 * Exhibit filenames that slipped through the HTML stripper.
 * Matches: "exhibit991_051326.htm", "ex10_1.htm"
 * Does NOT match: "Exhibit No." (space between), "example", "executor"
 */
const EXHIBIT_FILE_RE = /\b(exhibit|ex)\d+[-_.]/i

/**
 * Hyphenated SEC exhibit cover references that EXHIBIT_FILE_RE misses.
 * Matches: "EX-99.1", "ex-10.2", "EX_99.1" — the boundary before the exhibit number is a hyphen/underscore.
 * Does NOT match "Rex 99" / "annex 4" (no word-boundary "ex" + separator + N.N).
 */
const EXHIBIT_REF_RE = /\bex[-_]\d+\.\d/i

/**
 * Raw filing-document filenames that leaked into the text (e.g. "otheritemswhichareprovid.htm").
 * A ".htm"/".html" token in a headline always means a filename, never prose.
 */
const HTM_FILE_RE = /\.html?\b/i

/** XBRL namespace prefixes surviving HTML stripping. */
const XBRL_RE = /xbrli?:|iso4217:|xbrl:pure|xbrl:shares|:cash-generating/i

/** Standalone 10-digit SEC CIK number. */
const CIK_RE = /\b\d{10}\b/

/** SEC accession number in XXXXXXXXXX-YY-ZZZZZZ format. */
const ACCESSION_RE = /\b\d{10}-\d{2}-\d{6}\b/

/** Generic metadata tokens that are too short or too common to count as prose words. */
const METADATA_STOP = new Set([
  'true', 'false', 'null', 'with', 'that', 'this', 'from', 'have', 'been',
  'into', 'onto', 'over', 'also', 'only', 'both', 'each',
])

// ── Public: positive prose gate ───────────────────────────────────────────────

/**
 * Returns `true` only when `text` satisfies every structural prose criterion.
 *
 * Fails fast on known SEC/XBRL boilerplate, then requires:
 *   1. At least one run of 3+ consecutive lowercase letters (rejects ALL-CAPS blobs).
 *   2. Alphabetic characters ≥ 60 % of non-whitespace characters (rejects digit/symbol-heavy rows).
 *   3. At least 5 qualifying prose words (purely alphabetic, 3+ chars, not stop-word metadata).
 */
export function isReadableProse(text: string): boolean {
  if (!text || text.length < 20) return false

  // ── Negative: high-confidence boilerplate ─────────────────────────────────
  if (SEC_PREAMBLE_RE.test(text))  return false
  if (FORM_FILE_RE.test(text))     return false
  if (EXHIBIT_FILE_RE.test(text))  return false
  if (EXHIBIT_REF_RE.test(text))   return false
  if (HTM_FILE_RE.test(text))      return false
  if (XBRL_RE.test(text))          return false
  if (CIK_RE.test(text))           return false
  if (ACCESSION_RE.test(text))     return false

  // ── Positive: structural prose requirements ───────────────────────────────

  // 1. At least one run of 3+ consecutive lowercase letters.
  //    Rejects ALL-CAPS ticker/metadata blobs ("NASDAQ NYSE AMEX true false").
  if (!/[a-z]{3}/.test(text)) return false

  // 2. Alphabetic characters ≥ 60 % of all non-whitespace characters.
  //    Rejects strings dominated by digits, punctuation, or code symbols.
  const nonSpace = text.replace(/\s+/g, '')
  if (nonSpace.length > 0) {
    const alphaLen = (nonSpace.match(/[A-Za-z]/g) ?? []).length
    if (alphaLen / nonSpace.length < 0.60) return false
  }

  // 3. At least 5 qualifying prose words.
  //    A prose word is a purely alphabetic token of 3+ characters that is not
  //    a known metadata stop-word (e.g. "true", "false", "null", "from").
  const proseWords = (text.match(/\b[A-Za-z]{3,}\b/g) ?? [])
    .filter(w => !METADATA_STOP.has(w.toLowerCase()))
  if (proseWords.length < 5) return false

  return true
}

// ── HTML entity decoder ───────────────────────────────────────────────────────

function decodeEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#8220;|&ldquo;/g, '"')
    .replace(/&#8221;|&rdquo;/g, '"')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#183;|&middot;/g, '·')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
}

// ── Boilerplate prefix strippers ──────────────────────────────────────────────
// Ported from cleanSignalHeadline (useCompetitorSupabase). These are start-of-
// string patterns that appear when an SEC 8-K item heading leaks into the
// headline field instead of the actual event text.

const BOILERPLATE_PREFIXES: RegExp[] = [
  /^[a-z\s,;]*material definitive agreement[.,\s]*/i,
  /^[a-z\s,;]*directors or certain officers[^.]*\.\s*/i,
  /^departure of directors[^.]*\.\s*/i,
]

function stripBoilerplate(text: string): string {
  let out = text
  for (const p of BOILERPLATE_PREFIXES) {
    out = out.replace(p, '')
  }
  return out.trim()
}

// ── Exhibit preamble stripper ─────────────────────────────────────────────────
// SEC EDGAR embeds exhibit metadata before the actual content:
//   "EX-99.1 2 release.htm EX-99.1 release News Release Takeda's Zasocitinib..."
// Four passes strip the known token sequence, exposing the readable payload.

function stripExhibitPreamble(text: string): string {
  // Only process strings that begin with an exhibit reference
  if (!/^EX-[\d.]+/i.test(text)) return text

  let s = text.trim()

  // Pass 1: remove everything through the .htm filename
  s = s.replace(/^.*?\.html?\s*/i, '')

  // Pass 2: remove any residual EX-XX.X tokens (sometimes repeated twice)
  s = s.replace(/^(?:EX-[\d.]+\s+)+/gi, '')

  // Pass 3: remove optional "Exhibit XX.X " label
  s = s.replace(/^Exhibit\s+[\d.]+\s+/i, '')

  // Pass 4: remove a leading filename slug — the slug starts with a lowercase letter
  // and the actual content following it starts with a capital letter or digit
  const withoutFirst = s.replace(/^\S+\s+/, '').trim()
  if (
    withoutFirst &&
    !(/^[A-Z]/.test(s)) &&
    (/^[A-Z]/.test(withoutFirst) || /^\d/.test(withoutFirst))
  ) {
    s = withoutFirst
  }

  return s.trim() || text
}

// ── Sentence extractor ────────────────────────────────────────────────────────

const MAX_TEXT_LEN = 280

function extractSentence(text: string): string {
  // Prefer the first complete sentence (capital letter → content → terminal punctuation)
  const match = text.match(/([A-Z][^.!?]{15,400}[.!?])/)
  if (match?.[1]) return match[1].trim()
  // No complete sentence: return the text capped at MAX_TEXT_LEN
  if (text.length <= MAX_TEXT_LEN) return text
  const cut = text.lastIndexOf(' ', MAX_TEXT_LEN)
  return text.slice(0, cut > 0 ? cut : MAX_TEXT_LEN).trim() + '…'
}

// ── Public: signal input type + constants ─────────────────────────────────────

/** Subset of the company_signals row shape that this utility reads. */
export interface SignalTextInput {
  headline?: string | null
  body_excerpt?: string | null
}

/** Returned by cleanSignalText when neither field passes the prose gate. */
export const SIGNAL_FALLBACK = 'SEC filing — see source'

/**
 * SEC 8-K Item 5.02 heading patterns. These are structural legal item titles
 * ("Departure of Directors or Certain Officers; …") that frequently land in the
 * headline field for exec-change filings — they are not news and read as garbage.
 */
export const SEC_8K_ITEM_RE = /Departure of Directors|Departure\/Appointment|Appointment of (Certain )?Officers|Election of Directors|Directors or (Certain )?Officers|Compensatory Arrangements/i

/**
 * Readable headline for a signal. For exec-change rows whose headline is a raw
 * SEC 8-K Item 5.02 heading, returns a clean sentence naming the competitor;
 * otherwise defers to {@link cleanSignalText} (which may return SIGNAL_FALLBACK).
 */
export function buildReadableHeadline(
  s: SignalTextInput & { signal_type?: string },
  competitorName: string,
): string {
  if (s.signal_type === 'exec_change' && SEC_8K_ITEM_RE.test(s.headline ?? '')) {
    return `${competitorName} filed an executive or board change with the SEC.`
  }
  if (s.signal_type === 'label_update') {
    return s.headline ?? 'Drug label updated'
  }
  if (s.signal_type === 'regulatory_catalyst') {
    return s.headline ?? 'FDA regulatory event'
  }
  if (s.signal_type === 'hta_decision') {
    return s.headline ?? 'HTA decision published'
  }
  return cleanSignalText(s)
}

// ── Public: main cleaner ──────────────────────────────────────────────────────

/**
 * Picks the best readable string from `headline` / `body_excerpt`,
 * decodes HTML entities, strips known boilerplate prefixes, and extracts
 * the first clean sentence.
 *
 * Returns {@link SIGNAL_FALLBACK} — never raw garbage — when both fields fail
 * the prose gate.
 *
 * The input object is **never mutated**; callers retain access to the original
 * `headline` and `body_excerpt` for provenance chips or source links.
 */
export function cleanSignalText(signal: SignalTextInput): string {
  function process(raw: string | null | undefined): string | null {
    const trimmed = (raw ?? '').trim()
    if (!trimmed) return null
    const decoded   = decodeEntities(trimmed)
    const stripped  = stripBoilerplate(decoded)
    const deexhibit = stripExhibitPreamble(stripped)
    if (!isReadableProse(deexhibit)) return null
    return extractSentence(deexhibit)
  }

  return (
    process(signal.headline) ??
    process(signal.body_excerpt) ??
    SIGNAL_FALLBACK
  )
}
