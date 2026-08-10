/**
 * HTML entity decoding for ingested source text.
 *
 * WHY THIS EXISTS
 *
 * Ten scripts had grown their own hand-maintained decoder, each covering a few
 * named entities and at most three numeric ones. The result: 47 of 287 stored
 * signals carried literal entity text that users read on screen, for example
 *   "the FDA has approved DAWNZERA&#8482; (donidalorsen)"
 *   "Food and Drug Administration (&#8220;FDA&#8221;) notified BioCryst"
 * Named entities were mostly handled; numeric references were not.
 *
 * THE SUBTLE PART: NUMERIC REFERENCES IN THE 0x80-0x9F RANGE
 *
 * Publishers emit &#149; &#150; &#153; meaning bullet, en dash and trademark.
 * Those code points are C1 control characters in Unicode, so the obvious
 * implementation, String.fromCharCode(149), yields an invisible control
 * character rather than a bullet: it replaces visible wrong text with invisible
 * wrong text, which is harder to notice. Browsers resolve these through the
 * WHATWG windows-1252 replacement table, and so does this module.
 *
 * SINGLE PASS, BY CONSTRUCTION
 *
 * Chained .replace() calls double-decode: turning &amp; into & first rewrites
 * "&amp;#8220;" (a literal, escaped entity in the source) into "&#8220;", which
 * a later numeric pass then wrongly decodes into a quote mark. One regex over
 * all entity forms consumes each entity exactly once, so that cannot happen.
 *
 * Unrecognised named entities are left untouched rather than dropped, so an
 * unusual entity degrades to visible text instead of silently vanishing.
 */

/** WHATWG replacement table for numeric references 0x80-0x9F. */
const WINDOWS_1252 = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„',
  0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ',
  0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ',
  0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“',
  0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›',
  0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}

/**
 * Named entities seen in pharma IR, SEC and PubMed source text.
 * Deliberately not the full HTML5 set of 2000+ names: this is the list the
 * sources actually emit, and an unknown name is preserved rather than guessed.
 */
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  ndash: '–', mdash: '—', hellip: '…', bull: '•',
  trade: '™', reg: '®', copy: '©', deg: '°',
  eacute: 'é', egrave: 'è', uuml: 'ü', ouml: 'ö',
  auml: 'ä', szlig: 'ß', ccedil: 'ç', aacute: 'á',
  iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ',
  middot: '·', laquo: '«', raquo: '»', euro: '€',
  pound: '£', yen: '¥', cent: '¢', sup2: '²',
  frac12: '½', plusmn: '±', times: '×', minus: '−',
  thinsp: ' ', ensp: ' ', emsp: ' ', shy: '­',
  lsaquo: '‹', rsaquo: '›', dagger: '†', permil: '‰',
}

/** One entity, in any of its three forms. */
const ENTITY = /&(#[0-9]{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g

function codePointToString(code) {
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
 * Whitespace is NOT normalised here: &nbsp; decodes to a real non-breaking
 * space and the caller decides whether to collapse it, which keeps this function
 * purely a decoder.
 */
export function decodeHtmlEntities(text) {
  if (text == null) return ''
  const str = String(text)
  if (!str.includes('&')) return str
  return str.replace(ENTITY, (match, body) => {
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
export function hasHtmlEntities(text) {
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
 * eat "x<y then z>0" as though it were a tag. Verified against the live corpus:
 * every angle-bracket sequence present is one of these tags, and none is
 * notation.
 */
const KNOWN_TAG =
  /<\/?(?:p|br|hr|i|b|em|strong|sub|sup|span|div|ul|ol|li|h[1-6])\s*\/?>/gi

/**
 * Remove revealed formatting tags, leaving a space so words do not run together.
 * Run AFTER decodeHtmlEntities; running it before would find nothing, because at
 * that point the tags are still escaped.
 */
export function stripKnownHtmlTags(text) {
  if (text == null) return ''
  return String(text).replace(KNOWN_TAG, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * True when `text` contains one of the formatting tags above.
 *
 * Exists so a caller can tell a real tag removal apart from the incidental
 * whitespace collapsing that stripKnownHtmlTags also does. The one-time cleanup
 * needs that distinction: without it, every row with a stray double space looks
 * like a row needing repair, which would silently widen a targeted fix.
 */
export function hasKnownHtmlTags(text) {
  if (text == null) return false
  KNOWN_TAG.lastIndex = 0
  return KNOWN_TAG.test(String(text))
}
