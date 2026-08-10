/**
 * Deterministic signal facets — arc and theme (backend spec §4.3, §4.5).
 *
 * Both are derived from `signal_type` alone. No model assigns them, nothing here
 * is a judgment, and no input is interpretive — that is what keeps these inside
 * the no-AI line.
 *
 * Arc and theme are two different facets with two different jobs:
 *   - ARC   is ordering only. It sequences signals inside a thread. The reader
 *           never picks it.
 *   - THEME is browsing. It is the facet the CI reader filters and slices by.
 * Do not conflate them.
 */

// ── Arc (§4.5) ────────────────────────────────────────────────────────────────

/** The fixed arc display order, everywhere it applies. */
export const ARC_ORDER = [
  'trial',
  'evidence',
  'regulatory',
  'commercial',
  'ip',
  'deal',
  'personnel',
] as const

export type Arc = (typeof ARC_ORDER)[number]

/**
 * signal_type → arc. Evidence is its own arc position, not a sub-category of
 * trial. hta_decision sits in commercial/access.
 */
const SIGNAL_TYPE_TO_ARC: Record<string, Arc> = {
  trial_update:        'trial',
  publication:         'evidence',
  congress_abstract:   'evidence',
  regulatory_catalyst: 'regulatory',
  hta_decision:        'commercial',
  press_release:       'commercial',
  exclusivity_listing: 'ip',
  patent_grant:        'ip',
  ip_litigation:       'ip',
  deal:                'deal',
  exec_change:         'personnel',
}

/** Arc for a signal_type, or null when the type is unknown (never guessed). */
export function arcOf(signalType: string | null | undefined): Arc | null {
  if (!signalType) return null
  return SIGNAL_TYPE_TO_ARC[signalType] ?? null
}

/**
 * Position of an arc in the fixed order. Unknown arcs sort last rather than
 * throwing, so a new signal_type can never break ordering.
 */
export function arcPosition(arc: Arc | null): number {
  if (!arc) return ARC_ORDER.length
  const i = ARC_ORDER.indexOf(arc)
  return i === -1 ? ARC_ORDER.length : i
}

/** Sort comparator for signals inside a thread: arc position, then date. */
export function compareByArcThenDate(
  a: { signal_type?: string | null; date?: string | null },
  b: { signal_type?: string | null; date?: string | null },
): number {
  const byArc = arcPosition(arcOf(a.signal_type)) - arcPosition(arcOf(b.signal_type))
  if (byArc !== 0) return byArc
  return (a.date ?? '').localeCompare(b.date ?? '')
}

// ── Theme (§4.3) ──────────────────────────────────────────────────────────────

/** The deterministic browse facet. Not the AI-track taxonomy. */
export const THEMES = [
  'Pipeline and trials',
  'Evidence',
  'Regulatory',
  'Market access',
  'Commercial',
  'IP and exclusivity',
  'Deals and BD',
  'Leadership',
] as const

export type Theme = (typeof THEMES)[number]

/** signal_type → theme, exactly as specified in §4.3. */
const SIGNAL_TYPE_TO_THEME: Record<string, Theme> = {
  trial_update:        'Pipeline and trials',
  publication:         'Evidence',
  congress_abstract:   'Evidence',
  regulatory_catalyst: 'Regulatory',
  hta_decision:        'Market access',
  press_release:       'Commercial',
  exclusivity_listing: 'IP and exclusivity',
  patent_grant:        'IP and exclusivity',
  ip_litigation:       'IP and exclusivity',
  deal:                'Deals and BD',
  exec_change:         'Leadership',
}

/** Theme for a signal_type, or null when the type is unknown (never guessed). */
export function themeOf(signalType: string | null | undefined): Theme | null {
  if (!signalType) return null
  return SIGNAL_TYPE_TO_THEME[signalType] ?? null
}

/**
 * Themes actually present in a set of signals, in canonical THEMES order.
 * Use to build a filter bar that only offers themes the data can satisfy —
 * never a hardcoded list, so it travels to any therapeutic area.
 */
export function themesPresent(
  signals: Array<{ signal_type?: string | null }>,
): Theme[] {
  const present = new Set<Theme>()
  for (const s of signals) {
    const t = themeOf(s.signal_type)
    if (t) present.add(t)
  }
  return THEMES.filter((t) => present.has(t))
}
