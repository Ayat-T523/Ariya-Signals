/**
 * Signal transformers — Phase 3.3.
 *
 * `dbSignalToBaseCard` is the single canonical function that maps a raw
 * DbRecentSignal from Supabase to the display-layer BaseCard interface.
 *
 * Design constraints:
 *   - No AI. All enrichment is deterministic pattern matching.
 *   - All fields that can't be reliably extracted are null, never guessed.
 *   - Severity and WHY logic must stay in sync with WarRoom.tsx helpers;
 *     Phase 3.4 will migrate WarRoom to import from here instead.
 *   - sourceCoverage = 'high' for all SEC signals — EDGAR covers every
 *     US-listed filer and returns data on demand (not sampled or delayed).
 */

import type { DbRecentSignal } from './db'
import type { BaseCard, SignalType } from '../types/signal'
import { competitorsData } from '../data/kalvista'

// ── DB type → display SignalType ─────────────────────────────────────────────
const DB_TO_SIGNAL_TYPE: Record<string, SignalType> = {
  deal:          'deal',
  press_release: 'publication',
  exec_change:   'exec-move',
}

// ── Keyword sets (kept in sync with WarRoom.tsx CLINICAL_KW / COMMERCIAL_KW) ─
const CLINICAL_KW      = /phase [23]|phase iii|endpoint|efficacy|clinical trial|fda|ema|nda|approval|pdufa|advisory/i
const COMMERCIAL_KW    = /revenue|commercial|launch|market share|patient|prescription|growth/i
const HIGH_CLINICAL_KW = /phase [23] result|phase iii result|phase 3 result|phase iii data|phase 3 data|topline|top-line|primary endpoint met|fda approv|nda accepted|nda submitted|nda approved|ema approv|maa submitted|pdufa|regulatory approv/i
const SENIOR_EXEC_RE   = /\b(chief executive|chief financial|chief medical|chief scientific|chief commercial|president|ceo|cfo|cmo|cso|cco)\b/i

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeSeverity(s: DbRecentSignal): 'high' | 'medium' | 'low' {
  const text = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`
  if (s.signal_type === 'deal') return 'high'
  if (HIGH_CLINICAL_KW.test(text)) return 'high'
  if (s.signal_type === 'exec_change') {
    return SENIOR_EXEC_RE.test(text) ? 'high' : 'medium'
  }
  if (CLINICAL_KW.test(text) || COMMERCIAL_KW.test(text)) return 'medium'
  return 'low'
}

function computeDataFreshness(date: string | null): 'high' | 'medium' | 'low' {
  if (!date) return 'low'
  const daysOld = (Date.now() - new Date(date).getTime()) / 86400000
  return daysOld < 7 ? 'high' : daysOld < 30 ? 'medium' : 'low'
}

// Extract the first dollar-amount mention from filing text.
// Returns null when no clear figure is present — avoids hallucinating a value.
function extractDealValue(text: string): string | null {
  const m = text.match(/\$[\d,]+(?:\.\d+)?\s*(?:billion|million|[BMbm])\b/i)
  return m ? m[0] : null
}

// Compose a clean title from the raw headline + body_excerpt.
// Falls back to structured description when neither has a complete sentence.
function composeTitle(s: DbRecentSignal, competitorName: string): string {
  const raw  = s.headline?.trim() ?? ''
  const body = s.body_excerpt?.trim() ?? ''
  // Prefer headline when it contains a complete capital-starting sentence
  if (/[A-Z][^.!?]{15,}[.!?]/.test(raw)) return raw
  // Try body_excerpt for a complete sentence
  const bodyMatch = body.match(/([A-Z][^.!?]{15,200}[.!?])/)
  if (bodyMatch) return bodyMatch[1].trim()
  // Structured fallback: "<Competitor> — <Event type>"
  const TYPE_LABEL: Record<string, string> = {
    deal:          'Strategic Transaction',
    exec_change:   'Leadership Change',
    press_release: 'Public Disclosure',
  }
  return `${competitorName} — ${TYPE_LABEL[s.signal_type] ?? 'SEC Filing'}`
}

// buildWhyItMatters removed (§4-1): interpretation ("watch for implications",
// "assess relative positioning") is a paid-tier function. The free tier surfaces
// structural facts only — never an auto-generated "what this means".

export function buildSourceLabel(url: string | null, signalType: string): string {
  if (!url) return 'Source'
  if (url.includes('sec.gov')) {
    if (signalType === 'deal' || signalType === 'exec_change') return 'SEC 8-K'
    return 'SEC Filing'
  }
  if (/fda\.gov/i.test(url))            return 'FDA'
  if (/ema\.europa\.eu/i.test(url))     return 'EMA'
  if (/nice\.org\.uk/i.test(url))       return 'NICE'
  if (/clinicaltrials\.gov/i.test(url)) return 'ClinicalTrials.gov'
  return 'Source'
}

// ── Main transformer ─────────────────────────────────────────────────────────

export interface TransformerOptions {
  /** Tracked asset name (from onboarding). Appears in WHY text. */
  assetName?: string
  /** Tracked therapeutic area (from onboarding). Appears in WHY text. */
  indication?: string
}

/**
 * Map a raw Supabase DbRecentSignal → BaseCard.
 *
 * All null enrichment fields collapse silently in the UI — they are never
 * replaced with placeholder text or guessed values.
 */
export function dbSignalToBaseCard(
  s: DbRecentSignal,
  opts: TransformerOptions = {},
): BaseCard {
  const signalType: SignalType = DB_TO_SIGNAL_TYPE[s.signal_type] ?? 'publication'
  const competitor    = competitorsData.find((c) => c.id === s.competitor_id)
  const competitorName = competitor?.name ?? s.competitor_id

  const text = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`

  return {
    type:     signalType,
    title:    composeTitle(s, competitorName),
    date:     s.date ?? new Date().toISOString().slice(0, 10),
    entities: [competitorName],
    // summary is omitted — body_excerpt is raw filing text, not cleaned prose.
    // A future enrichment pass (Phase 4+) will populate this field.
    summary:  null,
    severity: computeSeverity(s),
    provenance: {
      sourceLabel:    buildSourceLabel(s.source_url, s.signal_type),
      sourceUrl:      s.source_url ?? '',
      lastRefreshed:  s.date ? `${s.date}T00:00:00Z` : new Date().toISOString(),
      // SEC EDGAR covers all US-listed filers with no sampling — always high.
      sourceCoverage: 'high',
      dataFreshness:  computeDataFreshness(s.date),
    },
    whyItMatters:         null, // §4-1: no auto-generated interpretation in the free tier
    dealValue:            signalType === 'deal' ? extractDealValue(text) : null,
    agencyOutcome:        null, // populated by regulatory transformer (Phase 4)
    attendingCompetitors: null, // not applicable for SEC filing signals
  }
}
