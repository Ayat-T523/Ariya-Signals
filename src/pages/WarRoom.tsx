/**
 * WarRoom.tsx — iteration-4.
 *
 * UI matched to the reference image (ariya-signals-main prototype, WarRoom.jsx):
 *   greeting header, 3 KPI tiles with deltas/captions/links,
 *   Market weather, Upcoming events, Weekly digest. Exact prototype palette
 *   (#0055BB blue / #050A44 navy). "Customise" button is visual-only (no edit mode).
 *
 * Data from src/data/kalvista.ts. lucide-react icons only.
 */

import { useState, useMemo, type ReactNode, type CSSProperties } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, ArrowUpRight,
  TrendingDown, TrendingUp, Pencil, ExternalLink,
} from 'lucide-react'
import { useApp, useConfig, useAccountIdentity } from '../context/AppContext'
import { importanceBand, bandToLegacyTier } from '../lib/deterministic/importance'
import { tierOf, sourceNameOf, type AttributionTier } from '../lib/deterministic/provenance'
import CompetitorBadge from '../components/ui/CompetitorBadge'
import ProvenanceChip from '../components/ui/ProvenanceChip'
import PaidGate from '../components/ui/PaidGate'
import {
  competitorsData,
  eventsData,
} from '../data/kalvista'
import { DEMO } from '../config/demo-config'
import {
  getAllSignalsSummary,
  getRegulatoryCalendar,
  getRecentSignals,
  getMarketImplications,
  getAllAssets,
  type DbAsset,
  type DbSignalSummary,
  type DbRegulatoryCalendarEvent,
  type DbRecentSignal,
  type DbMarketImplication,
} from '../lib/db'
import { cleanSignalText, SIGNAL_FALLBACK, buildReadableHeadline } from '../lib/signalText'

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ')
}


/** Days window used for narration summaries — must match NARRATION_DAYS in buildNarration.mjs */
const NARRATION_DAYS = 90

// â”€â”€ Keyword matchers for severity and WHY logic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CLINICAL_KW    = /phase [23]|phase iii|endpoint|efficacy|clinical trial|fda|ema|nda|approval|pdufa|advisory/i

// isCLevelChange and criticalCoOccursWithHAE removed with D11 (§4.2): both read
// importance out of phrasing. Importance is now scored from facts — arc, recency,
// source count, forward catalyst — in lib/deterministic/importance.ts.

function isSignalReadable(s: DbRecentSignal): boolean {
  return cleanSignalText(s) !== SIGNAL_FALLBACK
}

// ── Relevance gate ────────────────────────────────────────────────────────────
// Derived at runtime from the user's asset config via useConfig() / assets-config.ts.
// Passed explicitly to all gate functions below — no module-level constant.
type Lexicon = { inns: string[]; ta_terms: string[] }

// Tags that indicate an asset is in HAE development (matches indication_tags column)
const HAE_TAG_TERMS = ['hereditary angioedema', 'hae']

/**
 * Plain-language category words for the High importance tile caption.
 *
 * Keys are the display `type` values (TYPE_MAP output, which passes unmapped
 * signal_types straight through). Every signal_type present in live data is
 * covered: publication, press_release, exec_change, congress_abstract,
 * regulatory_catalyst, hta_decision, deal, trial_update. An unrecognised type
 * falls back to its own key rather than being dropped, so the caption stays
 * truthful if a new type appears before this map is updated.
 */
const HIGH_CAPTION_LABEL: Record<string, string> = {
  'regulatory_catalyst': 'regulatory',
  'hta_decision':        'access',
  'trial_update':        'trial',
  'publication':         'publication',
  'congress_abstract':   'congress',
  'deal':                'deal',
  'exec-move':           'leadership',
  'exec_change':         'leadership',
}

// ── EMA calendar event gates ──────────────────────────────────────────────────
// Gate 1 — event_type allowlist (COMP/HMPC/PDCO are irrelevant to HAE products)
const ALLOWED_EMA_EVENT_TYPES = new Set(['CHMP', 'PRAC', 'OTHER'])

// Gate 2 — HAE entity match for OTHER events; CHMP/PRAC plenary sessions always
// pass as scheduling signals (their titles never name individual drugs).
function isRelevantEMAEvent(e: DbRegulatoryCalendarEvent, lexicon: Lexicon): boolean {
  if (!ALLOWED_EMA_EVENT_TYPES.has(e.event_type)) return false
  if (e.event_type === 'CHMP' || e.event_type === 'PRAC') return true
  const title = (e.title ?? '').toLowerCase()
  return (
    lexicon.inns.some(term => title.includes(term.toLowerCase())) ||
    lexicon.ta_terms.some(term => title.includes(term.toLowerCase()))
  )
}

function countHAEAssets(assets: DbAsset[], competitorId: string): number {
  return assets.filter(a =>
    a.competitor_id === competitorId &&
    a.indication_tags?.some(tag =>
      HAE_TAG_TERMS.some(term => tag.toLowerCase().includes(term))
    )
  ).length
}

function isRelevant(s: DbRecentSignal, lexicon: Lexicon): boolean {
  const text = `${s.headline ?? ''} ${s.body_excerpt ?? ''}`.toLowerCase()
  return (
    lexicon.inns.some(term => text.includes(term.toLowerCase())) ||
    lexicon.ta_terms.some(term => text.includes(term.toLowerCase()))
  )
}

/**
 * Importance tier for a signal — D11 (§4.2), facts only.
 *
 * The score itself (arc weight → recency → source count → forward-catalyst
 * nudge) lives in lib/deterministic/importance.ts. This wrapper adds the one
 * thing that is local to the reader: the relevance gate. §3.1 defines the
 * isRelevant() gate and the severity/importance gate as both driven by the
 * selected asset's disease area, so a signal outside that area cannot reach the
 * top band however it scores — an approval for an unrelated drug is not
 * something to act on. That gate is a deterministic lexicon match on config,
 * never a keyword judgment about what the text "means".
 *
 * Replaces the previous keyword classifier, which read importance out of
 * phrasing ("material agreement", "hard regulatory setback").
 */
function computeSeverity(s: DbRecentSignal, lexicon: Lexicon, today: Date): 'high' | 'medium' | 'low' {
  // sourceCount and daysToCatalyst are omitted deliberately: no event is
  // currently carried by more than one source, and no future calendar row
  // carries a competitor or drug link, so neither can be supplied honestly yet.
  // Both terms activate in importance.ts the moment that data exists.
  const band = importanceBand(s, { today })
  const capped = !isRelevant(s, lexicon) && band === 'act' ? 'watch' : band
  return bandToLegacyTier(capped)
}

// buildWhyItMatters removed (§4-1): auto-generated "what this means" is a
// paid-tier function; the free tier shows structural facts only.

function buildSourceLabel(url: string | null, signalType: string): string {
  if (!url) return 'SEC EDGAR'
  if (url.includes('sec.gov')) {
    if (signalType === 'exec_change' || signalType === 'deal') return 'SEC 8-K'
    return 'SEC Filing'
  }
  return 'Source'
}

// §4-1: factual activity descriptor only — no interpretation ("monitor for…",
// "made a strategic move"). Prefer the real cleaned headline; else name the
// event class plainly.
const EVENT_CLASS: Record<string, string> = {
  exec_change:         'reported a leadership change',
  deal:                'disclosed a deal',
  press_release:       'issued a press release',
  publication:         'has a new publication',
  hta_decision:        'received an HTA decision',
  regulatory_catalyst: 'has a regulatory event',
  congress_abstract:   'presented a congress abstract',
  trial_update:        'has a trial update',
}
function buildNeedleText(s: DbRecentSignal): string {
  const cleaned = cleanSignalText(s)
  if (cleaned !== SIGNAL_FALLBACK) return cleaned
  return EVENT_CLASS[s.signal_type] ?? 'filed a public disclosure'
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type Alert = {
  id: string
  timestamp: string
  competitorId: string
  type: string
  severity: string
  headline: string
  whyItMatters?: string
  source?: string
  sourceUrl?: string | null
  /** Attribution tier — part of the §4.7 provenance contract. */
  tier?: AttributionTier | null
  /** When the record was last taken from its source (§4.7). */
  lastRefreshed?: string | null
}
type Competitor = (typeof competitorsData)[0]
type EventItem  = (typeof eventsData)[0]

// Live signal mapped to the fields CompactAlertCard actually reads
type LiveSignalDisplayItem = {
  id: string
  timestamp: string
  competitorId: string
  type: string
  severity: 'high' | 'medium' | 'low'
  headline: string
  // whyItMatters is absent by design (§4-1): the free tier carries no
  // auto-generated interpretation, so the display model has no field for it.
  source: string
  sourceUrl: string | null
  /** §4.7 provenance contract. */
  tier: AttributionTier | null
  lastRefreshed: string | null
  _isLive: true
}

// Merged static + live event (EventRow only reads id/date/title/expectedTopics/note)
type MergedEventItem = {
  id: string
  date: string
  title: string
  expectedTopics?: string[]
  note?: string
  location?: string
  attendingCompetitors?: string[]
  endDate?: string
  type?: string
  sourceType?: string
  sourceUrl?: string | null
  _source: 'static' | 'ema'
}

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Severity lives entirely in its own badge, next to the word it modifies —
// no card-edge accent. `high` is solid so it anchors a scan down the feed
// harder than a border ever did; medium and low stay tinted so only the
// signals that need triage carry weight. White on #C01041 is 6.2:1.
const SEVERITY_LABEL: Record<string, { bg: string; text: string; label: string }> = {
  high:   { bg: '#C01041',               text: '#FFFFFF',            label: 'HIGH' },
  medium: { bg: 'rgba(245,158,11,0.10)', text: '#92500A',            label: 'MED'  },
  low:    { bg: 'rgba(5,10,68,0.06)',    text: 'rgba(5,10,68,0.70)', label: 'LOW'  },
}

const SEVERITY_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 }

const TYPE_LABEL_BY_KEY: Record<string, string> = {
  'trial-update':    'Trial Update',
  'exec-move':       'Exec Move',
  'label-change':    'Label Change',
  'label-update':    'Label Update',
  'field-signal':    'Field Signal',
  'strategic-shift': 'Strategic Shift',
  'publication':     'Publication',
  'regulatory':      'Regulatory',
  'earnings':        'Earnings',
  'deal':            'Deal',
  'conference':      'Conference',
}
function typeLabel(t: string) {
  return TYPE_LABEL_BY_KEY[t] || (t ? t.charAt(0).toUpperCase() + t.slice(1) : '')
}

const POSTURE_STYLE: Record<string, { bg: string; text: string }> = {
  'Incumbent to displace':           { bg: 'rgba(5,10,68,0.08)',    text: 'rgba(5,10,68,0.70)' },
  'Adjacent oral competitor':        { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Adjacent injectable prophylaxis': { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Emerging direct threat':          { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging gene therapy':           { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
  'Emerging oral competitor':        { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
}

// â”€â”€ Market weather: competitive-pressure trend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const WINDOW_STATUS_CONFIG = {
  'Pressure building': { bg: 'rgba(225,29,72,0.12)',  text: '#C01041', icon: TrendingDown },
  'Pressure stable':   { bg: 'rgba(245,158,11,0.12)', text: '#92500A', icon: ArrowRight    },
  'Pressure easing':   { bg: 'rgba(16,185,129,0.10)', text: '#065F46', icon: TrendingUp    },
} as const
const SOURCE_TYPE_LABEL: Record<string, string> = {
  'official-congress':    'Official Congress',
  'company-ir':           'Company IR',
  'company-ir-aggregate': 'Company IR',
  'sec-edgar':            'SEC EDGAR',
}


// â”€â”€ Live data mappers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function mapDbSignalToDisplay(s: DbRecentSignal, assetName = DEMO.assetName, indication = DEMO.therapeuticArea, lexicon: Lexicon = { inns: [], ta_terms: [] }): LiveSignalDisplayItem {
  // Plain-language singular/plural is deliberately not attempted here: these read
  // as category counts ("2 regulatory"), not sentences, which stays readable for a
  // non-technical medical affairs user without inventing grammar rules.
  const TYPE_MAP: Record<string, string> = {
    deal:          'deal',
    press_release: 'publication',
    exec_change:   'exec-move',
  }
  const competitor = competitorById(s.competitor_id)
  const competitorName = competitor?.name ?? s.competitor_id
  return {
    id:           `live-${s.id}`,
    timestamp:    s.date ? `${s.date}T00:00:00Z` : new Date().toISOString(),
    competitorId: s.competitor_id,
    type:         TYPE_MAP[s.signal_type] ?? s.signal_type,
    severity:     computeSeverity(s, lexicon, new Date()),
    headline:     buildReadableHeadline(s, competitorById(s.competitor_id)?.name ?? 'This company'),
    // §4.7 requires a real source name. data_source records which pipeline wrote
    // the row and is 100% populated, so prefer it; the URL-derived label is only a
    // fallback and yields a bare "Source" for company IR domains.
    source:       sourceNameOf(s.data_source) ?? buildSourceLabel(s.source_url, s.signal_type),
    sourceUrl:    s.source_url,
    tier:         tierOf(s.signal_type),  // §4.7 provenance contract
    lastRefreshed: s.created_at ?? null,  // when we last took it from the source
    _isLive:      true,
  }
}

function mapCalendarEventToItem(e: DbRegulatoryCalendarEvent, lexicon: Lexicon): MergedEventItem {
  // Factual annotation derived from gate result — no blanket "may shape the timeline" text
  let note: string
  if (e.event_type === 'CHMP') {
    note = 'CHMP plenary · EU committee decisions on medicines'
  } else if (e.event_type === 'PRAC') {
    note = 'PRAC meeting · EU pharmacovigilance review'
  } else {
    // OTHER — passed Gate 2, so title contains an HAE term; cite the first match
    const title = (e.title ?? '').toLowerCase()
    const matchedTerm =
      lexicon.inns.find(t => title.includes(t.toLowerCase())) ??
      lexicon.ta_terms.find(t => title.includes(t.toLowerCase())) ??
      'HAE-related'
    note = `${matchedTerm} · EMA · ${e.start_date ?? ''}`
  }
  return {
    id:                   e.id,
    date:                 e.start_date ?? '',
    title:                e.title ?? `${e.event_type} Meeting`,
    expectedTopics:       [],
    note,
    attendingCompetitors: [],
    sourceUrl:            e.source_url,
    _source:              'ema',
  }
}

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function headerTimestamp(lastRefreshedAt: Date) {
  const now   = new Date()
  const dow   = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const month = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const day   = now.getDate()
  const time  = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const diffMin = Math.round((now.getTime() - lastRefreshedAt.getTime()) / 60000)
  const refreshLabel = diffMin < 1 ? 'JUST NOW' : `${diffMin} MIN AGO`
  return `${dow} · ${month} ${day} · ${time} · LAST REFRESH ${refreshLabel}`
}

function relTimeShort(ts: string, now: Date = new Date()) {
  const diffMs = now.getTime() - new Date(ts).getTime()
  const diffH  = Math.round(diffMs / (1000 * 60 * 60))
  if (diffH < 24) return `${Math.max(0, diffH)}h`
  return `${Math.round(diffH / 24)}d`
}

function daysUntilLabel(date: string) {
  const diff = Math.round((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return `${Math.abs(diff)}d ago`
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  return `in ${diff}d`
}

function dayMonthParts(date: string) {
  const d = new Date(date)
  return {
    day:   String(d.getUTCDate()).padStart(2, '0'),
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase(),
  }
}

function competitorById(id: string): Competitor | undefined {
  return competitorsData.find((c) => c.id === id)
}

// â”€â”€ Section card wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Card({ children, padding = '20px 22px', style }: {
  children: ReactNode
  padding?: string
  style?: CSSProperties
}) {
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid rgba(5,10,68,0.08)',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
      padding,
      ...style,
    }}>
      {children}
    </div>
  )
}

function CardHeader({ title, subtitle, right }: {
  title: ReactNode
  subtitle?: string
  right?: ReactNode
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      gap: '12px', marginBottom: '14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          {title}
        </h2>
        {subtitle && (
          <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.60)' }}>
            {subtitle}
          </span>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
    </div>
  )
}

function HeaderLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      style={{
        fontSize: '12px', fontWeight: 600, color: 'rgba(5,10,68,0.55)',
        textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px',
      }}
    >
      {children} <ArrowRight size={11} />
    </Link>
  )
}

// â”€â”€ KPI tile (compact, 3-up row) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function KpiTile({ label, value, delta, deltaTone = 'positive', caption, linkTo, linkLabel }: {
  label: string
  value: number | string
  delta?: string
  deltaTone?: 'positive' | 'negative' | 'neutral'
  caption?: string
  linkTo?: string
  linkLabel?: string
}) {
  const deltaColor = deltaTone === 'positive' ? '#0E7B5F' : deltaTone === 'negative' ? '#C01041' : 'rgba(5,10,68,0.50)'
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '14px',
      border: '1px solid rgba(5,10,68,0.08)',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
      padding: '14px 18px',
      display: 'flex', flexDirection: 'column',
      gap: '4px',
    }}>
      <p style={{
        margin: 0, fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.65)',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
        <span style={{
          fontSize: '26px', fontWeight: 700, color: 'rgba(5,10,68,0.92)',
          fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
        }}>
          {value}
        </span>
        {delta && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '2px',
            fontSize: '12px', fontWeight: 600, color: deltaColor,
          }}>
            <ArrowUpRight size={12} aria-hidden="true" />
            {delta}
          </span>
        )}
      </div>
      {caption && (
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
          {caption}
        </p>
      )}
      {linkTo && linkLabel && (
        <Link
          to={linkTo}
          style={{
            marginTop: '6px', fontSize: '12px', fontWeight: 600,
            color: '#0055BB', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: '3px',
          }}
        >
          {linkLabel} <ArrowRight size={11} />
        </Link>
      )}
    </div>
  )
}

// â”€â”€ Compact alert card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CompactAlertCard({ alert }: { alert: Alert }) {
  const sevLabel  = SEVERITY_LABEL[alert.severity]  || SEVERITY_LABEL.low
  const competitor = competitorById(alert.competitorId)

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '10px',
      border: '1px solid rgba(5,10,68,0.06)',
      padding: '12px 14px',
    }}>
      {/* Top row: chips left, age right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '9999px', background: 'rgba(5,10,68,0.06)',
          color: 'rgba(5,10,68,0.60)',
        }}>
          {competitor?.name ?? alert.competitorId}
        </span>
        <span style={{
          fontSize: '11px', fontWeight: 600, padding: '2px 8px',
          borderRadius: '9999px', background: 'rgba(0,85,187,0.08)',
          color: '#0055BB',
        }}>
          {typeLabel(alert.type)}
        </span>
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '2px 7px',
          borderRadius: '9999px', background: sevLabel.bg, color: sevLabel.text,
          letterSpacing: '0.04em',
        }}>
          {sevLabel.label}
        </span>
      </div>

      {/* Headline */}
      <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 700, color: 'rgba(5,10,68,0.92)', lineHeight: 1.35 }}>
        {decodeEntities(alert.headline)}
      </p>

      {/* Provenance chip — source + age, co-located with the claim */}
      {alert.source && (
        <div style={{ marginBottom: '4px' }}>
          <ProvenanceChip
            sourceLabel={alert.source}
            sourceUrl={alert.sourceUrl}
            date={alert.timestamp}
            tier={alert.tier}
            lastRefreshed={alert.lastRefreshed}
          />
        </div>
      )}

      {/* WHY */}
      {alert.whyItMatters && (
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.62)', lineHeight: 1.5 }}>
          <strong style={{
            fontSize: '10px', fontWeight: 700, color: 'rgba(5,10,68,0.65)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            WHY —{' '}
          </strong>
          {alert.whyItMatters}
        </p>
      )}
    </div>
  )
}

// â”€â”€ Compact competitor card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CompactCompetitorCard({
  competitor,
  liveSignals,
  recentSignals,
  haeAssetCount,
  lexicon,
}: {
  competitor: Competitor
  liveSignals: DbSignalSummary | null
  recentSignals: DbRecentSignal[]
  haeAssetCount: number
  lexicon: Lexicon
}) {
  const posture = POSTURE_STYLE[competitor.strategicPosture] || { bg: 'rgba(5,10,68,0.06)', text: 'rgba(5,10,68,0.60)' }
  const pipelineCount = haeAssetCount

  let lastSignal: string
  let isLive = false
  if (liveSignals?.latestDate) {
    lastSignal = relTimeShort(`${liveSignals.latestDate}T00:00:00Z`) + ' ago'
    isLive = true
  } else {
    lastSignal = '—'
  }

  // Build signal-type severity label (readable signals for this competitor only)
  const today = new Date()
  const compSignals = recentSignals.filter((s) => s.competitor_id === competitor.id)
  const highSignals = compSignals.filter((s) => computeSeverity(s, lexicon, today) === 'high')
  const medSignals  = compSignals.filter((s) => computeSeverity(s, lexicon, today) === 'medium')

  let activityLabel: string
  let activityIsLive: boolean

  if (compSignals.length > 0) {
    activityIsLive = true
    const parts: string[] = []
    if (highSignals.length > 0) parts.push(`${highSignals.length} high`)
    if (medSignals.length > 0)  parts.push(`${medSignals.length} medium`)
    const low = compSignals.length - highSignals.length - medSignals.length
    if (low > 0 && parts.length === 0) parts.push(`${low} low`)
    activityLabel = parts.join(' · ') + ' signal' + (compSignals.length > 1 ? 's' : '')
  } else {
    activityIsLive = false
    activityLabel = ''
  }

  // §4-1: body text is the most recent signal's real headline. The stored
  // company_summaries narration is AI-generated interpretation ("which the
  // Ekterly team should consider...") — legacy from the AI track, not read here.
  const hasSignals = compSignals.length > 0
  const activityText: string | null = hasSignals ? buildNeedleText(compSignals[0]) : null

  return (
    <Link
      to={`/competitors/${competitor.id}`}
      className="hover-lift"
      style={{
        textDecoration: 'none',
        background: '#FFFFFF',
        borderRadius: '14px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
        padding: '16px 18px',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <CompetitorBadge name={competitor.name} size={32} />
        <p style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          {competitor.name}
        </p>
      </div>

      {/* Posture chip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          display: 'inline-block',
          padding: '2px 10px', borderRadius: '9999px',
          fontSize: '11px', fontWeight: 600,
          background: posture.bg, color: posture.text,
        }}>
          {competitor.strategicPosture}
        </span>
        <span
          title="Hand-authored editorial label — not computed from data"
          style={{
            padding: '1px 7px', borderRadius: '9999px',
            fontSize: '10px', fontWeight: 500,
            background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.40)',
            cursor: 'help', whiteSpace: 'nowrap',
          }}
        >
          Editorial
        </span>
      </div>

      {/* Signal summary */}
      {activityIsLive && activityLabel && (
        <p style={{ margin: '0 0 4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: '#10B981' }}>
          {activityLabel}
        </p>
      )}
      {activityText ? (
        <p style={({
          margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.60)',
          lineHeight: 1.5,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        } as CSSProperties)}>
          {activityText}
        </p>
      ) : (
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.35)', lineHeight: 1.5, fontStyle: 'italic' }}>
          No recent signals in the last {NARRATION_DAYS} days
        </p>
      )}

      {/* Footer stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        marginTop: '4px', paddingTop: '10px',
        borderTop: '1px solid rgba(5,10,68,0.06)',
      }}>
        <div>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.60)' }}>
            Pipeline
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.85)' }}>
            {pipelineCount} {pipelineCount === 1 ? 'asset' : 'assets'}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: 0, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.60)' }}>
            Last signal
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '14px', fontWeight: 500, color: 'rgba(5,10,68,0.65)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isLive && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', flexShrink: 0, display: 'inline-block' }} />
            )}
            {lastSignal}
          </p>
        </div>
      </div>
    </Link>
  )
}

// â”€â”€ Upcoming event row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EventRow({ event, last }: { event: MergedEventItem; last: boolean }) {
  const { day, month } = dayMonthParts(event.date)
  const subtitle = event.expectedTopics?.[0] || event.note || ''
  return (
    <Link
      to={`/intelligence?tab=events&event=${event.id}`}
      style={{
        textDecoration: 'none',
        display: 'flex', alignItems: 'center', gap: '14px',
        padding: '10px 4px',
        borderBottom: last ? 'none' : '1px solid rgba(5,10,68,0.06)',
      }}
    >
      {/* Date block */}
      <div style={{ textAlign: 'center', minWidth: '36px' }}>
        <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.85)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
          {day}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(5,10,68,0.65)' }}>
          {month}
        </p>
      </div>

      {/* Title + EMA chip + subtitle */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: '14px', fontWeight: 700, color: 'rgba(5,10,68,0.88)',
          lineHeight: 1.35,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {event.title}
        </p>
        {event._source === 'ema' && (
          <span style={{
            display: 'inline-block', marginTop: '2px',
            padding: '1px 7px', borderRadius: '9999px',
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
            background: 'rgba(0,52,114,0.10)', color: '#003472',
          }}>
            EMA
          </span>
        )}
        {event._source !== 'ema' && event.sourceType && SOURCE_TYPE_LABEL[event.sourceType] && (
          <span style={{
            display: 'inline-block', marginTop: '2px',
            padding: '1px 7px', borderRadius: '9999px',
            fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em',
            background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.55)',
          }}>
            {SOURCE_TYPE_LABEL[event.sourceType]}
          </span>
        )}
        {subtitle && (
          <p style={{
            margin: '2px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.50)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Countdown + source link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.65)', whiteSpace: 'nowrap' }}>
          {daysUntilLabel(event.date)}
        </span>
        {event.sourceUrl && (
          <button
            type="button"
            title="View source"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(event.sourceUrl!, '_blank', 'noreferrer') }}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'rgba(5,10,68,0.35)', display: 'inline-flex', alignItems: 'center' }}
          >
            <ExternalLink size={10} />
          </button>
        )}
      </div>
    </Link>
  )
}

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function WarRoom() {
  const { unreadCount, readAlerts, watchedCompetitors } = useApp()
  const account = useAccountIdentity()
  const { assetName, indication, lexiconInns, lexiconTaTerms } = useConfig()
  const lexicon = useMemo(() => ({ inns: lexiconInns, ta_terms: lexiconTaTerms }), [lexiconInns, lexiconTaTerms])
  const navigate = useNavigate()
  const [sortMode, setSortMode] = useState<'importance' | 'recency'>('importance')

  // â”€â”€ Live data via React Query (stale-while-revalidate, 5-min background refresh) â”€â”€
  // Sorted for stable key comparison — refetches automatically when watchlist changes
  const watchedIds = Array.from(watchedCompetitors).sort()
  const filterIds  = watchedIds.length > 0 ? watchedIds : undefined

  const { data: liveData, isSuccess: liveDataLoaded, dataUpdatedAt } = useQuery({
    queryKey: ['war-room-live', watchedIds],
    queryFn: () => Promise.all([
      getAllSignalsSummary(filterIds),  // KPI tiles: watchlist-filtered
      getRecentSignals(NARRATION_DAYS, filterIds), // Signal feed: scoped to watched competitors (strict config scoping)
      getRegulatoryCalendar(),
      getMarketImplications(),
      getAllAssets(),                   // indication_tags for HAE asset count per competitor
      // §4-1: getCompetitorSummaries() dropped — company_summaries holds
      // AI-generated interpretation, which the free tier must not surface.
    ]).then(([summary, recent, calendar, implications, assets]) => ({
      summary, recent, calendar, implications, assets,
    })),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000,
  })

  const signalsSummary     = liveData?.summary       ?? new Map<string, DbSignalSummary>()
  const recentLiveSignals  = (liveData?.recent ?? ([] as DbRecentSignal[]))
  const calendarEvents     = liveData?.calendar      ?? ([] as DbRegulatoryCalendarEvent[])
  const marketImplications = liveData?.implications  ?? ([] as DbMarketImplication[])
  const allAssets          = liveData?.assets        ?? ([] as DbAsset[])
  const lastRefreshedAt    = dataUpdatedAt ? new Date(dataUpdatedAt) : new Date()

  // HAE asset count per competitor — indication_tags filtered, not total asset count
  const haeAssetCountMap = new Map<string, number>(
    competitorsData.map(c => [c.id, countHAEAssets(allAssets, c.id)])
  )

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const cutoff7d = sevenDaysAgo.toISOString().slice(0, 10)
  const newSignalCount7d = recentLiveSignals.filter((s) => s.date !== null && s.date >= cutoff7d).length

  // â”€â”€ Derived data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Strip XBRL/accession-prefix boilerplate before anything else touches the feed
  const readableSignals = recentLiveSignals.filter(isSignalReadable)
  // Strict config scoping: the feed is fetched watched-only (filterIds), so every signal here
  // already belongs to a watched competitor. The watched guard is kept as a belt-and-suspenders
  // boundary; the prior `|| isRelevant(lexicon)` expander is removed because it admitted
  // non-watched competitors (e.g. Intellia's HAELO signals) that the user never selected.
  const relevantSignals = readableSignals.filter(
    s => watchedCompetitors.has(s.competitor_id ?? '')
  )

  // Top 5 alerts — relevant live signals only
  const liveDisplayItems = relevantSignals.map(s => mapDbSignalToDisplay(s, assetName, indication, lexicon))

  const topAlerts = (liveDisplayItems as unknown as Alert[])
    .sort((a, b) => {
      if (sortMode === 'importance') {
        const sevDiff = (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0)
        if (sevDiff !== 0) return sevDiff
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      }
      // recency: pure most-recent-first
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    })
    .slice(0, 5)

  // KPI metrics — derived from live signals only
  /**
   * The signals behind the High importance tile.
   *
   * The tile's number and its caption MUST come from this one array. They used to
   * come from two different populations: the number counted high-and-unread, the
   * caption described all high signals regardless of read state, and the caption
   * only ever named two of the seven categories. So the tile could read "1" above
   * the words "No high-priority signals", which is exactly what it did.
   */
  const highUnreadItems    = liveDisplayItems.filter((a) => (a as unknown as Alert).severity === 'high' && !readAlerts.has((a as unknown as Alert).id))
  const highUnread         = highUnreadItems.length
  const newThisWeek        = newSignalCount7d
  const pharvarisUnread    = liveDisplayItems.filter((a) => (a as unknown as Alert).competitorId === 'pharvaris' && !readAlerts.has((a as unknown as Alert).id)).length
  const trackedCompetitorCount = watchedCompetitors.size
  // Signals that mention clinical trial keywords (press releases with clinical content)
  const trialAlerts        = liveDisplayItems.filter((a) => CLINICAL_KW.test((a as unknown as Alert).headline ?? '')).length
  const commercialAlerts   = liveDisplayItems.filter((a) => ['exec-move', 'deal', 'earnings'].includes((a as unknown as Alert).type ?? '')).length
  // Caption for the High importance tile, built from the SAME array as its number
  // so the two can never disagree. Categories are counted generically from the
  // signals present rather than from a hardcoded shortlist, so a category nobody
  // thought to enumerate still gets described instead of vanishing.
  const highCaption = (() => {
    if (highUnreadItems.length === 0) return 'Nothing needs action right now'
    const byType = new Map<string, number>()
    for (const item of highUnreadItems) {
      const label = (item as unknown as Alert).type || 'other'
      byType.set(label, (byType.get(label) ?? 0) + 1)
    }
    const parts = [...byType.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, n]) => `${n} ${HIGH_CAPTION_LABEL[label] ?? label}`)
    return `${parts.join(' · ')} · review recommended`
  })()

  // Tracked competitors — watched set, sorted by most recent signal (no cap)
  const trackedCompetitors = competitorsData
    .filter((c) => watchedCompetitors.has(c.id))
    .sort((a, b) => {
      const aDate = signalsSummary.get(a.id)?.latestDate ?? ''
      const bDate = signalsSummary.get(b.id)?.latestDate ?? ''
      return bDate.localeCompare(aDate)
    })

  // Upcoming events — merge live regulatory_calendar + static eventsData
  const nowStr = new Date().toISOString().slice(0, 10)
  const liveEventItems: MergedEventItem[] = calendarEvents
    .filter((e) => e.start_date !== null && (e.start_date as string) >= nowStr)
    .filter(e => isRelevantEMAEvent(e, lexicon))
    .map(e => mapCalendarEventToItem(e, lexicon))
    .filter((e) => !/^\d{1,2}:\d{2}$/.test(e.title ?? ''))
  const liveTitles = new Set(liveEventItems.map((e) => e.title.toLowerCase()))
  const staticEventItems: MergedEventItem[] = (eventsData as unknown as MergedEventItem[])
    .filter((e) => new Date(e.date) >= new Date())
    .map((e) => ({ ...e, sourceType: (e as unknown as { sourceType?: string }).sourceType, _source: 'static' as const }))
    .filter((e) => !liveTitles.has((e.title ?? '').toLowerCase()))
  const upcomingEvents: MergedEventItem[] = [...liveEventItems, ...staticEventItems]
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .slice(0, 5)

  // Market weather — "What moved this week": one signal per competitor, limited to the last 7 days
  const weeklyRelevantSignals = relevantSignals.filter(s => s.date !== null && s.date >= cutoff7d)
  const signalsByCompetitor = new Map<string, DbRecentSignal>()
  for (const s of weeklyRelevantSignals) {
    if (!signalsByCompetitor.has(s.competitor_id)) signalsByCompetitor.set(s.competitor_id, s)
  }
  const liveNeedleItems = [...signalsByCompetitor.values()]
    .filter(isSignalReadable)
    .slice(0, 5)
    .map((s) => ({
      competitorId: s.competitor_id,
      text: buildNeedleText(s),
      _isLive: true as const,
    }))
  const needleItems = liveNeedleItems

  // Market weather — pressure status weighted by signal severity
  const weatherToday = new Date()
  const highSigCount = recentLiveSignals.filter((s) => computeSeverity(s, lexicon, weatherToday) === 'high').length
  const medSigCount  = recentLiveSignals.filter((s) => computeSeverity(s, lexicon, weatherToday) === 'medium').length
  const pressureStatus: keyof typeof WINDOW_STATUS_CONFIG =
    highSigCount >= 2                            ? 'Pressure building'
    : (highSigCount >= 1 || medSigCount >= 3)    ? 'Pressure stable'
    : 'Pressure easing'

  // Market weather — implication bullets (live from DB only)
  // §4-1: market implications are interpretation — gated behind PaidGate, never
  // rendered in the free tier (see the Implications block below).

  // Weekly digest — top 3 relevant signals from the live feed
  const digestItems = relevantSignals
    .slice(0, 3)
    .map((s) => ({
      competitorId: s.competitor_id,
      text: buildReadableHeadline(s, competitorById(s.competitor_id)?.name ?? 'This company'),
    }))
    .filter(item => item.text !== SIGNAL_FALLBACK)

  // Market weather status config
  const statusCfg = WINDOW_STATUS_CONFIG[pressureStatus] ?? WINDOW_STATUS_CONFIG['Pressure stable']
  const StatusIcon = statusCfg.icon

  return (
    <div data-page-pad style={{ padding: '20px 32px' }}>

      {/* â”€â”€ Top header: timestamp + greeting + actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: '16px', marginBottom: '20px',
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{
            margin: '0 0 4px', fontSize: '11px', fontWeight: 700,
            letterSpacing: '0.08em', color: 'rgba(5,10,68,0.60)',
          }}>
            {headerTimestamp(lastRefreshedAt)}
          </p>
          <h1 style={{
            margin: 0, fontSize: '24px', fontWeight: 700,
            color: 'rgba(5,10,68,0.92)', lineHeight: 1.25,
          }}>
            {/* Greet by the signed-in account's own name, and omit the name entirely
                when the account carries none. This used to read userData.user.name
                from static data, greeting every visitor as "David". */}
            {account.displayName ? `${greeting()}, ${account.displayName}.` : `${greeting()}.`}{' '}
            <span style={{ color: 'rgba(5,10,68,0.55)', fontWeight: 600 }}>
              Here's the state of {indication}.
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'rgba(5,10,68,0.50)' }}>
            {assetName} · {indication}
            {trackedCompetitors.length > 0 && (
              <>
                {' · '}
                {trackedCompetitors.slice(0, 4).map((c) => c.name).join(' · ')}
                {trackedCompetitors.length > 4 && ` · +${trackedCompetitors.length - 4} more`}
              </>
            )}
          </p>
        </div>

        {/* Customise button. The Ask Ariya CTA that sat here was removed with the
            rest of the RAG chat feature (handoff index §2, frontend §2). */}
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, paddingTop: '6px' }}>
          {/* Customise — visual only (no edit-mode behaviour) */}
          <button
            type="button"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '9999px',
              fontSize: '13px', fontWeight: 600,
              background: 'transparent',
              color: 'rgba(5,10,68,0.65)',
              border: '1.5px solid rgba(5,10,68,0.20)',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            <Pencil size={13} /> Customise
          </button>
        </div>
      </div>

      {/* â”€â”€ 3 KPI tiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div data-tour="war-room" data-kpi-grid style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '14px', marginBottom: '20px',
      }}>
        <KpiTile
          label="New this week"
          value={newThisWeek ?? 0}
          delta="last 7 days"
          deltaTone="neutral"
          caption={
            liveDataLoaded
              ? `${newThisWeek} new signals in the last 7 days`
              : 'Loading signal count…'
          }
          linkTo="/alerts"
          linkLabel="Open new arrivals"
        />
        <KpiTile
          label="Unread signals"
          value={unreadCount}
          delta={`${pharvarisUnread} from Pharvaris`}
          deltaTone="neutral"
          caption={`Across ${trackedCompetitorCount} competitors · ${trialAlerts} clinical · ${commercialAlerts} commercial`}
          linkTo="/alerts"
          linkLabel="Open inbox"
        />
        <KpiTile
          label="High importance"
          value={highUnread}
          caption={highCaption}
          linkTo="/alerts"
          linkLabel="Triage now"
        />
      </div>

      {/* â”€â”€ 2-column main grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div data-war-room-grid style={{
        display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px',
        gap: '20px', alignItems: 'flex-start',
      }}>

        {/* â”€â”€ LEFT COLUMN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

          {/* Top signals to triage */}
          <Card>
            <CardHeader
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  Top signals to triage
                  {liveDataLoaded && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', flexShrink: 0, display: 'inline-block' }} />
                  )}
                </span>
              }
              subtitle={
                liveDataLoaded
                  ? `${readableSignals.length} live · ${topAlerts.length} shown · ${unreadCount} unread`
                  : `${topAlerts.length} shown · ${unreadCount} unread`
              }
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {([
                    { value: 'importance', label: 'Importance' },
                    { value: 'recency',    label: 'Recency' },
                  ] as const).map((opt) => {
                    const on = sortMode === opt.value
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setSortMode(opt.value)}
                        aria-pressed={on}
                        style={{
                          padding: '4px 10px', borderRadius: '9999px',
                          fontSize: '11px', fontWeight: on ? 700 : 500,
                          background: on ? '#050A44' : 'transparent',
                          color: on ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
                          border: `1.5px solid ${on ? '#050A44' : 'rgba(5,10,68,0.15)'}`,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                  <HeaderLink to="/alerts">Open feed</HeaderLink>
                </div>
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {topAlerts.length > 0 ? (
                topAlerts.map((alert) => (
                  <CompactAlertCard key={alert.id} alert={alert} />
                ))
              ) : (
                <p style={{ margin: '8px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)', fontStyle: 'italic' }}>
                  {!liveDataLoaded
                    ? 'Loading signals…'
                    : watchedCompetitors.size === 0
                      ? 'Add competitors to your watchlist to see their signals here.'
                      : 'No signals from your tracked competitors in the last 30 days.'}
                </p>
              )}
            </div>
          </Card>

          {/* Tracked competitors */}
          <Card>
            <CardHeader
              title="Tracked competitors"
              subtitle="last 7 days · signal volume"
              right={<HeaderLink to="/competitors">All competitors</HeaderLink>}
            />
            {trackedCompetitors.length > 0 ? (
              <div data-two-col-grid style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: '12px',
              }}>
                {trackedCompetitors.map((c) => (
                  <CompactCompetitorCard key={c.id} competitor={c} liveSignals={signalsSummary.get(c.id) ?? null} recentSignals={relevantSignals} haeAssetCount={haeAssetCountMap.get(c.id) ?? (c.pipeline || []).length} lexicon={lexicon} />
                ))}
              </div>
            ) : (
              <p style={{ margin: '8px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)', fontStyle: 'italic' }}>
                You're not tracking any competitors yet.{' '}
                <a href="/competitors" style={{ color: '#0055BB', textDecoration: 'none', fontWeight: 600 }}>Go to Competitors</a>
                {' '}to add some to your watchlist.
              </p>
            )}
          </Card>

          {/* The Ask Ariya panel that sat here is removed: RAG chat is AI and is
              excluded (handoff index §2, frontend §2). Frontend §6.1's War Room
              composition does not include it either, so nothing replaces it. */}
        </div>

        {/* â”€â”€ RIGHT COLUMN â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>

          {/* Market weather */}
          <Card>
            <CardHeader
              title={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  {`Market weather · ${assetName}`}
                  {liveDataLoaded && liveNeedleItems.length > 0 && (
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', flexShrink: 0, display: 'inline-block' }} />
                  )}
                </span>
              }
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    padding: '2px 9px', borderRadius: '9999px',
                    background: 'rgba(5,10,68,0.06)',
                    fontSize: '10px', fontWeight: 700,
                    color: 'rgba(5,10,68,0.55)', letterSpacing: '0.05em',
                  }}>
                    30D
                  </span>
                </div>
              }
            />

            {/* Pressure status */}
            <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '5px 12px', borderRadius: '9999px',
                background: statusCfg.bg, color: statusCfg.text,
                fontSize: '14px', fontWeight: 700,
              }}>
                <StatusIcon size={14} strokeWidth={2.5} />
                {pressureStatus}
              </span>
              <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
                over the last 30 days
              </span>
            </div>

            {/* What moved this week */}
            <div style={{ marginBottom: '14px' }}>
              <p style={{
                margin: '0 0 8px', fontSize: '10px', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.10em',
                color: 'rgba(5,10,68,0.65)',
              }}>
                What moved this week
              </p>
              {needleItems.length > 0 ? (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {needleItems.map((item, i) => {
                    const cName = competitorById(item.competitorId)?.name ?? item.competitorId
                    return (
                      <li key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                        <span style={{ marginTop: '7px', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(5,10,68,0.60)', flexShrink: 0 }} />
                        <span style={{ fontSize: '14px', color: 'rgba(5,10,68,0.72)', lineHeight: 1.5 }}>
                          <strong style={{ fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>{cName}</strong>
                          {' — '}{decodeEntities(item.text)}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.40)', fontStyle: 'italic' }}>
                  {watchedCompetitors.size === 0
                    ? 'Track competitors to see their weekly moves here.'
                    : 'No notable moves from your tracked competitors this week.'}
                </p>
              )}
            </div>

            {/* Implications */}
            <div>
              <PaidGate label="Market Implications" description="Strategic interpretation of signals · Available in the full platform" />
            </div>

            {/* Footer */}
            <div style={{
              marginTop: '14px', paddingTop: '12px',
              borderTop: '1px solid rgba(5,10,68,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '10px',
            }}>
              <Link
                to="/alerts"
                style={{
                  fontSize: '12px', fontWeight: 600, color: '#0055BB',
                  textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px',
                }}
              >
                Read full assessment <ArrowRight size={11} />
              </Link>
            </div>
          </Card>

          {/* Upcoming events */}
          <Card padding="20px 22px 12px">
            <CardHeader
              title="Upcoming events"
              subtitle={
                liveDataLoaded && liveEventItems.length > 0
                  ? `${liveEventItems.length} from EMA`
                  : undefined
              }
              right={<HeaderLink to="/intelligence?tab=events">All</HeaderLink>}
            />
            <div>
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((e, i) => (
                  <EventRow key={e.id} event={e} last={i === upcomingEvents.length - 1} />
                ))
              ) : (
                <p style={{ margin: '8px 0', fontSize: '13px', color: 'rgba(5,10,68,0.40)', fontStyle: 'italic' }}>
                  No upcoming events found.{' '}
                  <a href="/intelligence?tab=events" style={{ color: '#0055BB', textDecoration: 'none', fontWeight: 600 }}>Check the Intelligence Feed</a>
                  {' '}for the full calendar.
                </p>
              )}
            </div>
          </Card>

          {/* Weekly digest */}
          <Card>
            <CardHeader
              title="Your weekly digest"
              right={<HeaderLink to="/myspace/alerts">Configure</HeaderLink>}
            />
            {digestItems.length > 0 ? (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {digestItems.map((item, i) => {
                  const cName = competitorById(item.competitorId)?.name ?? item.competitorId
                  return (
                    <li key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                      <span style={{ marginTop: '7px', width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(5,10,68,0.60)', flexShrink: 0 }} />
                      <span style={{ fontSize: '14px', color: 'rgba(5,10,68,0.72)', lineHeight: 1.5 }}>
                        <strong style={{ fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>{cName}</strong>
                        {' — '}{item.text}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.40)', fontStyle: 'italic' }}>
                No recent signals to summarise
              </p>
            )}
          </Card>

        </div>
      </div>

    </div>
  )
}
