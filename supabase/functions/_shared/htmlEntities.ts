/**
 * htmlEntities.ts — HTML entity decoding for Deno edge functions.
 *
 * MIRROR of the canonical implementation in scripts/lib/html-entities.mjs.
 * Edge functions run in Deno and cannot import from scripts/, so this copy
 * exists deliberately. If you change one, change both — the two must agree or
 * the same press release will be stored differently depending on which ingest
 * path saw it first.
 *
 * WHY: the IR RSS and PubMed edge functions previously did no decoding at all,
 * so entity text reached the database and users read it on screen:
 *   "the FDA has approved DAWNZERA&#8482; (donidalorsen)"
 *   "Food and Drug Administration (&#8220;FDA&#8221;) notified BioCryst"
 *
 * THE SUBTLE PART: numeric references in the 0x80-0x9F range. Publishers emit
 * &#149; &#150; &#153; meaning bullet, en dash and trademark, but those code
 * points are C1 control characters in Unicode, so String.fromCharCode(149)
 * yields an invisible control character instead of a bullet: visible wrong text
 * becomes invisible wrong text, which is harder to notice. Browsers resolve
 * these through the WHATWG windows-1252 replacement table, and so does this.
 *
 * Single regex pass, because chained .replace() double-decodes: turning &amp;
 * into & first rewrites a literal escaped "&amp;#8220;" into "&#8220;", which a
 * later numeric pass then wrongly decodes into a quote mark.
 */

/** WHATWG replacement table for numeric references 0x80-0x9F. */
const WINDOWS_1252: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„',
  0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ',
  0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ',
  0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“',
  0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}

/**
 * Named entities seen in pharma IR, SEC and PubMed source text. Deliberately not
 * the full HTML5 set: this is what the sources actually emit, and an unknown
 * name is preserved rather than guessed.
 */
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  ndash: '–', mdash: '—', hellip: '…', bull: '•',
  trade: '™', reg: '®', copy: '©', deg: '°',
  eacute: 'é', egrave: 'è', uuml: 'ü', ouml: 'ö',
  auml: 'ä', szlig: 'ß', ccedil: 'ç', aacute: 'á',
  iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  middot: '·', laquo: '«', raquo: '»', euro: '€',
  pound: '£', yen: '¥', cent: '¢', sup2: '²',
  frac12: '½', plusmn: '±', times: '×', minus: '−',
  thinsp: ' ', ensp: ' ', emsp: ' ', shy: '­',
  lsaquo: '‹', rsaquo: '›', dagger: '†', permil: '‰',
}

/** One entity, in any of its three forms. */
const ENTITY = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g

function codePointToString(code: number): string | null {
  if (Number.isNaN(code)) return null
  // C1 range: resolve through the windows-1252 table the way browsers do.
  if (code >= 0x80 && code <= 0x9f) return WINDOWS_1252[code] ?? null
  // Null, surrogates and out-of-range values have no valid character.
  if (code === 0 || (code >= 0xd800 && code <= 0xdfff) || code > 0x10ffff) return null
  try {
    return String.fromCodePoint(code)
  } catch {
    return null
  }
}

/**
 * Decode HTML entities in `text`.
 *
 * Returns '' for null/undefined so callers can pass optional fields directly.
 * Whitespace is NOT normalised: &nbsp; decodes to a real non-breaking space and
 * the caller decides whether to collapse it.
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (text == null) return ''
  const str = String(text)
  if (!str.includes('&')) return str
  return str.replace(ENTITY, (match, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X'
      const code = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10)
      return codePointToString(code) ?? match
    }
    // Named entities are case-sensitive in HTML5; try the exact name, then
    // lowercase, so ABBREV-cased source text still resolves.
    return NAMED[body] ?? NAMED[body.toLowerCase()] ?? match
  })
}

/** True when `text` still contains anything that looks like an entity. */
export function hasHtmlEntities(text: string | null | undefined): boolean {
  if (text == null) return false
  ENTITY.lastIndex = 0
  return ENTITY.test(String(text))
}

/**
 * Formatting tags that publishers escape inside abstracts, so decoding reveals
 * them as real tags. PubMed does this: an abstract arrives carrying
 * "&lt;p&gt;Introduction: ..." which decodes to a visible "<p>Introduction: ...".
 *
 * Deliberately an allowlist and not the general /<[^>]+>/ used on raw HTML.
 * Scientific text contains inequalities, and a general pattern would silently
 * eat "x<y then z>0" as though it were a tag.
 */
const KNOWN_TAG =
  /<\/?(?:p|br|hr|i|b|em|strong|sub|sup|span|div|ul|ol|li|h[1-6])\s*\/?>/gi

/**
 * Remove revealed formatting tags, leaving a space so words do not run together.
 * Run AFTER decodeHtmlEntities; running it before would find nothing, because at
 * that point the tags are still escaped.
 */
export function stripKnownHtmlTags(text: string | null | undefined): string {
  if (text == null) return ''
  return String(text).replace(KNOWN_TAG, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * True when `text` contains one of the formatting tags above.
 *
 * Exists so a caller can tell a real tag removal apart from the incidental
 * whitespace collapsing that stripKnownHtmlTags also does.
 */
export function hasKnownHtmlTags(text: string | null | undefined): boolean {
  if (text == null) return false
  KNOWN_TAG.lastIndex = 0
  return KNOWN_TAG.test(String(text))
}
