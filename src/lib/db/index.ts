import { supabase } from '../supabase'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DbAsset {
  id: string
  inn: string
  synonyms: string[] | null
  mechanism: string | null
  max_phase: number | null
  approval_date: string | null
  manufacturer_current: string | null
  drug_class_detail: string | null
  indication_type: string | null
  // Phase 2.2: ownership slug matching competitors.json (null = own asset)
  competitor_id: string | null
  // Phase 2.4: all CT.gov condition terms + DailyMed indication terms, stored permissively
  indication_tags: string[] | null
}

export interface DbTrial {
  id: string
  nct_id: string
  asset_id: string
  // Phase 2.1: competitor slug resolved from sponsor name (null = own asset or unresolved)
  company_id: string | null
  title: string | null
  phase: string | null
  status: string
  brief_summary: string | null
  start_date: string | null
  completion_date: string | null
  conditions: string[] | null
  sites_count: number | null
  raw_json: Record<string, any> | null
}

export interface DbRegulatoryEvent {
  id: string
  asset_id: string
  event_type: string
  date: string | null
  authority: string
  headline: string
  details: string | null
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getAllAssets(): Promise<DbAsset[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('assets')
    .select('id, inn, synonyms, mechanism, max_phase, approval_date, manufacturer_current, drug_class_detail, indication_type, competitor_id, indication_tags')
  return data ?? []
}

export async function getTrialsByAssetIds(assetIds: string[]): Promise<DbTrial[]> {
  if (!supabase || !assetIds.length) return []
  const { data } = await supabase
    .from('trials')
    .select('id, nct_id, asset_id, company_id, title, phase, status, brief_summary, start_date, completion_date, conditions, sites_count, raw_json')
    .in('asset_id', assetIds)
    .order('start_date', { ascending: false })
  return data ?? []
}

// Phase 2.5: fetch all indication-relevant trials for a competitor via indication_tags overlap.
// Two-step: (1) find asset IDs where competitor_id matches and indication_tags overlaps the user's
// TA lexicon; (2) fetch trials for those assets. This supplements getTrialsByAssetIds — it catches
// trials for assets not yet in the stub pipeline JSON but registered in ClinicalTrials.gov.
export async function getTrialsByCompetitorAndIndication(
  competitorId: string,
  indicationTags: string[],
): Promise<DbTrial[]> {
  if (!supabase || !competitorId || !indicationTags.length) return []

  // Postgres array literal: {"hereditary angioedema","HAE"}
  const pgLiteral = `{${indicationTags.map(t => `"${t}"`).join(',')}}`

  const { data: assetRows } = await supabase
    .from('assets')
    .select('id')
    .eq('competitor_id', competitorId)
    .filter('indication_tags', 'ov', pgLiteral)

  const matchedIds = (assetRows ?? []).map((a: any) => a.id as string)
  if (!matchedIds.length) return []

  const { data } = await supabase
    .from('trials')
    .select('id, nct_id, asset_id, company_id, title, phase, status, brief_summary, start_date, completion_date, conditions, sites_count, raw_json')
    .in('asset_id', matchedIds)
    .order('start_date', { ascending: false })

  return data ?? []
}

export async function getRegulatoryEventsByAssetIds(assetIds: string[]): Promise<DbRegulatoryEvent[]> {
  if (!supabase || !assetIds.length) return []
  const { data } = await supabase
    .from('regulatory_events')
    .select('id, asset_id, event_type, date, authority, headline, details')
    .in('asset_id', assetIds)
    .order('date', { ascending: false })
  return data ?? []
}

export interface DbRegulatoryCalendarEvent {
  id: string
  event_type: string
  title: string | null
  start_date: string | null
  end_date: string | null
  source_url: string | null
}

export async function getRegulatoryCalendar(): Promise<DbRegulatoryCalendarEvent[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('regulatory_calendar')
    .select('id, event_type, title, start_date, end_date, source_url')
    .order('start_date', { ascending: true })
  return data ?? []
}

export interface DbFinancialSnapshot {
  id: string
  competitor_id: string
  fiscal_year: number
  total_revenue_raw: number | null
  total_revenue_usd: number | null
  currency: string
  rd_expense_raw: number | null
  rd_expense_usd: number | null
  hae_revenue_usd: number | null
  exchange_rate_usd: number | null
  filing_date: string | null
  source_url: string | null
}

export interface DbCompanySignal {
  id: string
  competitor_id: string
  signal_type: string
  date: string | null
  headline: string | null
  body_excerpt: string | null
  items: string | null
  source_url: string | null
  accession_number: string
}

export async function getFinancialsByCompetitorId(competitorId: string): Promise<DbFinancialSnapshot[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('financial_snapshots')
    .select('id, competitor_id, fiscal_year, total_revenue_raw, total_revenue_usd, currency, rd_expense_raw, rd_expense_usd, hae_revenue_usd, exchange_rate_usd, filing_date, source_url')
    .eq('competitor_id', competitorId)
    .order('fiscal_year', { ascending: false })
    .limit(3)
  return data ?? []
}

export async function getSignalsByCompetitorId(competitorId: string): Promise<DbCompanySignal[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('company_signals')
    .select('id, competitor_id, signal_type, date, headline, body_excerpt, items, source_url, accession_number')
    .eq('competitor_id', competitorId)
    .order('date', { ascending: false })
    .limit(20)
  return data ?? []
}

export interface DbSignalSummary {
  count: number
  latestDate: string | null
}

export async function getAllSignalsSummary(competitorIds?: string[]): Promise<Map<string, DbSignalSummary>> {
  if (!supabase) return new Map()
  let query = supabase
    .from('company_signals')
    .select('competitor_id, date')
    .order('date', { ascending: false })
  if (competitorIds && competitorIds.length > 0) {
    query = query.in('competitor_id', competitorIds)
  }
  const { data } = await query
  if (!data) return new Map()
  const result = new Map<string, DbSignalSummary>()
  for (const row of data) {
    const cid = row.competitor_id as string
    if (!result.has(cid)) result.set(cid, { count: 0, latestDate: null })
    const entry = result.get(cid)!
    entry.count++
    if (!entry.latestDate && row.date) entry.latestDate = row.date as string
  }
  return result
}

export interface DbRecentSignal {
  id: string
  competitor_id: string
  signal_type: 'deal' | 'press_release' | 'exec_change' | string
  date: string | null
  headline: string | null
  body_excerpt: string | null
  items: string | null
  source_url: string | null
  accession_number: string
}

export async function getRecentSignals(limitDays: number, competitorIds?: string[]): Promise<DbRecentSignal[]> {
  if (!supabase) return []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - limitDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  let query = supabase
    .from('company_signals')
    .select('id, competitor_id, signal_type, date, headline, body_excerpt, items, source_url, accession_number')
    .gte('date', cutoffStr)
    .order('date', { ascending: false })
  if (competitorIds && competitorIds.length > 0) {
    query = query.in('competitor_id', competitorIds)
  }
  const { data } = await query
  return data ?? []
}

export interface DbMarketImplication {
  id: string
  type: string
  content: string
  display_order: number
  period_label: string | null
}

export async function getMarketImplications(): Promise<DbMarketImplication[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('market_intelligence')
    .select('id, type, content, display_order, period_label')
    .eq('active', true)
    .order('display_order', { ascending: true })
  return data ?? []
}

export interface DbDocument {
  id: string
  competitor_id: string
  source_url: string
  document_type: string
  source_label: string | null
  date_published: string | null
  word_count: number | null
  ingested_at: string
}

export async function getDocumentsByCompetitorId(competitorId: string): Promise<DbDocument[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('documents')
    .select('id, competitor_id, source_url, document_type, source_label, date_published, word_count, ingested_at')
    .eq('competitor_id', competitorId)
    .order('date_published', { ascending: false })
  return data ?? []
}

// ── Lookup helpers ────────────────────────────────────────────────────────────

// Find a Supabase asset by matching against its INN or any synonym.
// Used to link stub pipeline entries (which use codes like "TAK-079") to assets.
export function findAssetByCode(code: string, assets: DbAsset[]): DbAsset | undefined {
  const q = code.toLowerCase().trim()
  return assets.find(a =>
    a.inn === q ||
    a.synonyms?.some(s => s.toLowerCase() === q)
  )
}
