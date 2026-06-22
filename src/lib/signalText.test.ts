/**
 * signalText.test.ts — Phase 3A acceptance tests
 *
 * All fixtures are real rows from company_signals (queried June 2026).
 * No test runner is configured; run with:  npx tsx src/lib/signalText.test.ts
 *
 * Exit code 0 = all pass.  Exit code 1 = one or more failures.
 */

import { isReadableProse, cleanSignalText, SIGNAL_FALLBACK } from './signalText.js'

// ── Minimal harness ───────────────────────────────────────────────────────────

let passed = 0
let failed = 0

function assert(label: string, actual: unknown, expected: unknown): void {
  if (actual === expected) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}`)
    console.error(`     expected: ${JSON.stringify(expected)}`)
    console.error(`     received: ${JSON.stringify(actual)}`)
    failed++
  }
}

function assertNotFallback(label: string, actual: string): void {
  assert(label, actual !== SIGNAL_FALLBACK, true)
}

function assertFallback(label: string, actual: string): void {
  assert(`${label} → fallback`, actual, SIGNAL_FALLBACK)
}

function assertContains(label: string, actual: string, fragment: string): void {
  const ok = actual.includes(fragment)
  if (ok) {
    console.log(`  ✓  ${label}`)
    passed++
  } else {
    console.error(`  ✗  ${label}`)
    console.error(`     expected to contain: ${JSON.stringify(fragment)}`)
    console.error(`     received:            ${JSON.stringify(actual)}`)
    failed++
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// isReadableProse — GOOD samples
// Real body_excerpt / headline values from company_signals, June 2026.
// All should return true.
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── isReadableProse: GOOD samples (expect true) ─────────────────────')

assert(
  'Intellia HAELO Phase 3 body_excerpt (2026-06-15)',
  isReadableProse(
    'On June 13, 2026, the Company announced additional positive results from the global Phase 3 HAELO clinical trial of lonvoguran ziclumeran for hereditary angioedema (HAE). The results were presented at the EAACI Annual Congress 2026.',
  ),
  true,
)

assert(
  'Ionis bepirovirsen pivotal data headline (2026-05-28)',
  isReadableProse(
    'On May 28, 2026, Ionis announced that its partner, GSK, reported positive pivotal data for bepirovirsen, an investigational ASO for the treatment of CHB.',
  ),
  true,
)

assert(
  'Ionis Hantson board appointment headline (2026-06-08)',
  isReadableProse(
    'Hantson to the Board of Directors On June 4, 2026, the Board of Directors of Ionis Pharmaceuticals, Inc. appointed Ludwig N. Hantson as a member of the Board effective June 4, 2026.',
  ),
  true,
)

assert(
  'Ionis Parshall board retirement headline (2026-03-09)',
  isReadableProse(
    'Lynne Parshall from the Board of Directors On March 3, 2026, B. Lynne Parshall, a member of the Board of Directors of Ionis Pharmaceuticals, notified the Company that she will be retiring from the Board.',
  ),
  true,
)

assert(
  'CSL Behring Andembry Q1 headline (2026-04-05)',
  isReadableProse('CSL Behring reports strong Andembry uptake in Q1 2026 earnings update'),
  true,
)

assert(
  'CSL Behring Germany formulary headline (2026-02-14)',
  isReadableProse('Andembry achieves formulary access in Germany ahead of schedule'),
  true,
)

assert(
  'BioCryst Blackstone loan body_excerpt (2026-01-23)',
  isReadableProse(
    'On January 23, 2026, BioCryst Pharmaceuticals, Inc., a Delaware corporation, entered into a Loan Agreement by and among BioCryst, as borrower, and Blackstone Alternative Credit Advisors LP and Blackstone Life Sciences Advisors.',
  ),
  true,
)

assert(
  'Astria merger approval headline (2026-01-21)',
  isReadableProse(
    'On January 21, 2026, Astria issued a press release announcing the approval of the Merger Proposal.',
  ),
  true,
)

// ═══════════════════════════════════════════════════════════════════════════════
// isReadableProse — GARBAGE samples
// Real body_excerpt / headline values from company_signals, June 2026.
// All should return false.
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── isReadableProse: GARBAGE samples (expect false) ─────────────────')

assert('empty string', isReadableProse(''), false)
assert('too short (< 20 chars)', isReadableProse('ts.'), false)

// Takeda 6-K cover page bodies — headline is null, body starts with form filename
// then SEC preamble. SEC_PREAMBLE_RE fires.
assert(
  'Takeda form6k_060926 cover page body (2026-06-09)',
  isReadableProse(
    '6-K 1 form6k_060926.htm 6-K Document FORM 6-K U.S. SECURITIES AND EXCHANGE COMMISSION Washington, D.C. 20549 Report of Foreign Private Issuer Pursuant to Rule 13a-16 or 15d-16 of the Securities Exchange Act of 1934 For the month of June 2026 Commission File Number 001-38757 TAKEDA PHARMACEUTICAL COMPANY LIMITED',
  ),
  false,
)

assert(
  'Takeda form6k-2 variant cover page body (2026-05-13)',
  isReadableProse(
    '6-K 1 form6k-2_051326.htm 6-K Document FORM 6-K U.S. SECURITIES AND EXCHANGE COMMISSION Washington, D.C. 20549 Report of Foreign Private Issuer Pursuant to Rule 13a-16 or 15d-16 of the Securities Exchange Act of 1934 For the month of May 2026',
  ),
  false,
)

assert(
  'Takeda form6k_052626x3 cover page body (2026-05-26)',
  isReadableProse(
    '6-K 1 form6k_052626x3.htm 6-K Document FORM 6-K U.S. SECURITIES AND EXCHANGE COMMISSION Washington, D.C. 20549 Report of Foreign Private Issuer Pursuant to Rule 13a-16 or 15d-16 of the Securities Exchange Act of 1934 For the month of May 2026',
  ),
  false,
)

// Takeda exhibit financial appendix — EXHIBIT_FILE_RE fires on "exhibit991_"
assert(
  'Takeda exhibit991 financial appendix body (2026-05-13)',
  isReadableProse(
    '6-K 1 exhibit991_051326.htm 6-K Document Exhibit 99.1 FINANCIAL APPENDIX Definition of Non-IFRS Measures Definition and Explanation of Non-IFRS Measures and U.S. Dollar Convenience Translations A- 1 Reconciliations and Other Financial Information',
  ),
  false,
)

// Intellia 8-K cover page — SEC_PREAMBLE_RE fires
assert(
  'Intellia 8-K UNITED STATES SEC cover page body (2026-04-27)',
  isReadableProse(
    '8-K UNITED STATES SECURITIES AND EXCHANGE COMMISSION WASHINGTON, D.C. 20549 FORM 8-K CURRENT REPORT Pursuant to Section 13 or 15(d) of the Securities Exchange Act of 1934 Date of Report (Date of earliest event reported): April 27, 2026 INTELLIA THERAPEUTICS, INC.',
  ),
  false,
)

assert(
  'Intellia 8-K SEC cover page body — deal variant (2026-03-02)',
  isReadableProse(
    '8-K UNITED STATES SECURITIES AND EXCHANGE COMMISSION WASHINGTON, D.C. 20549 FORM 8-K CURRENT REPORT Pursuant to Section 13 or 15(d) of the Securities Exchange Act of 1934 Date of Report (Date of earliest event reported): March 2, 2026 INTELLIA THERAPEUTICS, INC.',
  ),
  false,
)

// ═══════════════════════════════════════════════════════════════════════════════
// cleanSignalText — GOOD signals (should return readable text, not fallback)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── cleanSignalText: GOOD signals (expect readable text) ─────────────')

// Headline is a generic 4-word SEC title (fails prose gate) → falls through to
// body_excerpt which is a full readable sentence about HAELO.
const intelliaHaelo = cleanSignalText({
  headline: 'Intellia Therapeutics — Other Events',
  body_excerpt:
    'On June 13, 2026, the Company announced additional positive results from the global Phase 3 HAELO clinical trial of lonvoguran ziclumeran for hereditary angioedema (&#8220;HAE&#8221;). The results were presented at the EAACI Annual Congress 2026 in Istanbul.',
})
assertNotFallback('Intellia HAELO: headline falls through to body', intelliaHaelo)
assertContains('Intellia HAELO: contains Phase 3 content', intelliaHaelo, 'Phase 3 HAELO')

// Good headline — returns directly without touching body
const ionisBepi = cleanSignalText({
  headline:
    'On May 28, 2026, Ionis announced that its partner, GSK, reported positive pivotal data for bepirovirsen, an investigational ASO for the treatment of CHB.',
  body_excerpt:
    'On May 28, 2026, Ionis announced that its partner, GSK, reported positive pivotal data for bepirovirsen.',
})
assertNotFallback('Ionis bepirovirsen: good headline returned', ionisBepi)
assertContains('Ionis bepirovirsen: contains drug name', ionisBepi, 'bepirovirsen')

// Good headline with no terminal punctuation — returned as-is (≤ MAX_TEXT_LEN)
const cslAndembry = cleanSignalText({
  headline: 'CSL Behring reports strong Andembry uptake in Q1 2026 earnings update',
  body_excerpt:
    '(Illustrative — specific revenue figure not confirmed from official CSL report.)',
})
assertNotFallback('CSL Andembry: readable headline returned', cslAndembry)
assertContains('CSL Andembry: drug name present', cslAndembry, 'Andembry')

// Board appointment — mixed-case, readable
const ionisHantson = cleanSignalText({
  headline:
    'Hantson to the Board of Directors On June 4, 2026, the Board of Directors (&#8220; Board &#8221;) of Ionis Pharmaceuticals, Inc. appointed Ludwig N. Hantson as a member of the Board effective June 4, 2026.',
  body_excerpt: null,
})
assertNotFallback('Ionis Hantson: board appointment readable', ionisHantson)

// Boilerplate prefix stripping: headline starts with "Material Definitive Agreement."
// The prefix is stripped; remaining sentence contains real content.
const boilerplateStrip = cleanSignalText({
  headline: null,
  body_excerpt:
    'Material Definitive Agreement. BioCryst entered into an exclusive license agreement for the commercialisation of berotralstat in Asia-Pacific markets.',
})
assertNotFallback('Boilerplate prefix stripped: body readable after strip', boilerplateStrip)
assertContains('Boilerplate prefix stripped: content preserved', boilerplateStrip, 'BioCryst')

// HTML entities decoded: &#8220; → " etc.
const htmlDecoded = cleanSignalText({
  headline: null,
  body_excerpt:
    'On April 21, 2026, we announced additional positive results from the pivotal study of zilganersen in children and adults living with AxD, a rare, progressive and often fatal neurological condition (&#8220;AxD&#8221;) with no approved disease-modifying treatments.',
})
assertNotFallback('HTML entities decoded: body passes prose gate', htmlDecoded)

// ═══════════════════════════════════════════════════════════════════════════════
// cleanSignalText — GARBAGE signals (should return SIGNAL_FALLBACK)
// ═══════════════════════════════════════════════════════════════════════════════

console.log('\n── cleanSignalText: GARBAGE signals (expect fallback) ───────────────')

// Pharvaris / Takeda hollow rows — both fields null
assertFallback(
  'null/null hollow row (Pharvaris 2026-06-11)',
  cleanSignalText({ headline: null, body_excerpt: null }),
)

assertFallback(
  'undefined/undefined',
  cleanSignalText({}),
)

// Takeda: null headline + 6-K cover page body
assertFallback(
  'Takeda 6-K: null headline + SEC preamble body (2026-06-09)',
  cleanSignalText({
    headline: null,
    body_excerpt:
      '6-K 1 form6k_060926.htm 6-K Document FORM 6-K U.S. SECURITIES AND EXCHANGE COMMISSION Washington, D.C. 20549 Report of Foreign Private Issuer Pursuant to Rule 13a-16 or 15d-16 of the Securities Exchange Act of 1934 For the month of June 2026',
  }),
)

// Takeda: null headline + exhibit manifest body
assertFallback(
  'Takeda exhibit: null headline + exhibit manifest body (2026-05-13)',
  cleanSignalText({
    headline: null,
    body_excerpt:
      '6-K 1 exhibit991_051326.htm 6-K Document Exhibit 99.1 FINANCIAL APPENDIX Definition of Non-IFRS Measures and U.S. Dollar Convenience Translations A- 1 Reconciliations and Other Financial Information',
  }),
)

// Intellia "Other Events" Apr 27: generic 4-word headline (fails prose gate: only 4 prose
// words) + 8-K SEC cover page body (fails SEC_PREAMBLE_RE) → both fields fail → fallback
assertFallback(
  'Intellia Apr 27: 4-word headline + SEC preamble body (2026-04-27)',
  cleanSignalText({
    headline: 'Intellia Therapeutics — Other Events',
    body_excerpt:
      '8-K UNITED STATES SECURITIES AND EXCHANGE COMMISSION WASHINGTON, D.C. 20549 FORM 8-K CURRENT REPORT Pursuant to Section 13 or 15(d) of the Securities Exchange Act of 1934 Date of Report (Date of earliest event reported): April 27, 2026 INTELLIA THERAPEUTICS, INC.',
  }),
)

// ═══════════════════════════════════════════════════════════════════════════════
// Summary
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n${'─'.repeat(60)}`)
console.log(`  ${passed} passed   ${failed} failed`)
console.log('─'.repeat(60))
if (failed > 0) process.exit(1)
