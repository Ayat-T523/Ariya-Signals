import { supabase } from '../supabase'
import type { LexiconRow } from '../lexicon'

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
  why_it_matters: string | null
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
    .select('id, competitor_id, signal_type, date, headline, body_excerpt, items, source_url, accession_number, why_it_matters')
    .eq('competitor_id', competitorId)
    .order('date', { ascending: false })
    .limit(20)
  return data ?? []
}

// HTA decisions are historical and low-volume (e.g. a 2021 NICE TA). They would be
// crowded out of getSignalsByCompetitorId's 20-most-recent window by frequent SEC
// filings, so fetch them on a dedicated signal_type-scoped query that the date-desc
// limit can't bury.
export async function getHtaSignalsByCompetitorId(competitorId: string): Promise<DbCompanySignal[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('company_signals')
    .select('id, competitor_id, signal_type, date, headline, body_excerpt, items, source_url, accession_number, why_it_matters')
    .eq('competitor_id', competitorId)
    .eq('signal_type', 'hta_decision')
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
  why_it_matters: string | null
  clean_headline: string | null
  what_changed: string | null
  suggested_action: string | null
  // AI-classified severity ('HIGH'/'MEDIUM'/'LOW', uppercase, or null when the
  // synthesis pipeline hasn't reached this row yet) — see signalSeverity.ts's
  // resolveSeverity(), the single place this gets normalized + falls back.
  ai_severity: string | null
}

export async function getRecentSignals(limitDays: number, competitorIds?: string[]): Promise<DbRecentSignal[]> {
  if (!supabase) return []
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - limitDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  let query = supabase
    .from('company_signals')
    .select('id, competitor_id, signal_type, date, headline, body_excerpt, items, source_url, accession_number, why_it_matters, clean_headline, what_changed, suggested_action, ai_severity')
    .gte('date', cutoffStr)
    .order('date', { ascending: false })
  if (competitorIds && competitorIds.length > 0) {
    query = query.in('competitor_id', competitorIds)
  }
  const { data } = await query
  return data ?? []
}

export interface DbCompetitorSummary {
  competitor_id: string
  competitor_summary: string | null
  summary_updated_at: string
}

/** Returns a map of competitor_id → narration text (null when no recent signals). */
export async function getCompetitorSummaries(): Promise<Map<string, string | null>> {
  if (!supabase) return new Map()
  const { data } = await supabase
    .from('company_summaries')
    .select('competitor_id, competitor_summary, summary_updated_at')
  const map = new Map<string, string | null>()
  for (const row of (data ?? []) as DbCompetitorSummary[]) {
    map.set(row.competitor_id, row.competitor_summary)
  }
  return map
}

export interface DbMarketImplication {
  id: string
  type: string
  content: string
  display_order: number
  period_label: string | null
  created_at: string
}

/** @param days Freshness window -- implications older than this are excluded, not just
 *  sorted last. Default 7 matches their own stored `period_label` ("last 7 days"): showing
 *  a stale implication as current would misrepresent it, and Ariya's provenance/freshness
 *  promise (PRODUCT.md) is load-bearing, not decorative. */
export async function getMarketImplications(days = 7): Promise<DbMarketImplication[]> {
  if (!supabase) return []
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data } = await supabase
    .from('market_intelligence')
    .select('id, type, content, display_order, period_label, created_at')
    .eq('active', true)
    .gte('created_at', cutoff)
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

export async function getTrialsForCalendarYear(
  competitorIds: string[],
  year: number,
): Promise<DbTrial[]> {
  if (!supabase || !competitorIds.length) return []
  const { data } = await supabase
    .from('trials')
    .select('id, nct_id, asset_id, company_id, title, phase, status, start_date, completion_date')
    .in('company_id', competitorIds)
    .gte('start_date', `${year}-01-01`)
    .lt('start_date', `${year + 1}-01-01`)
    .order('start_date', { ascending: true })
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

// Every asset_lexicon row (inn + synonyms). The table is small reference data
// (one row per tracked drug), so it is fetched whole and filtered client-side by
// expandLexiconInns rather than queried per drug.
//
// NOTE: there is deliberately no getLexiconByInn here. Returning one drug's
// synonyms invited them to be used as a landscape list, which narrowed relevance
// matching from 153 live signals to 40 in testing. Fetch the table with
// getAssetLexicon and expand the config landscape with expandLexiconInns instead.
export async function getAssetLexicon(): Promise<LexiconRow[] | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('asset_lexicon')
    .select('inn, brand_name, synonyms, competitor_id')
    .order('inn')
  if (error) throw error
  return (data as LexiconRow[] | null) ?? null
}

// ── Per-user profile (user_profiles) ─────────────────────────────────────────

export interface DbUserProfile {
  user_id: string
  indication: string | null
  asset_id: string | null
  asset_name: string | null
  /**
   * Canonical Frontend Step 2 fields. Additive (see the accompanying
   * migration) -- null on every row that predates this step. asset_id/
   * asset_name above are reused as-is for the Home Asset identity/display
   * name rather than duplicated; these two columns exist only for the two
   * concepts that had no prior column at all (Disease Area, Therapeutic Area).
   */
  disease_area_id: string | null
  therapeutic_area_id: string | null
  onboarding_complete: boolean
  onboarding_version: string | null
}

export async function getUserProfile(userId: string): Promise<DbUserProfile | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('user_profiles')
    .select('user_id, indication, asset_id, asset_name, disease_area_id, therapeutic_area_id, onboarding_complete, onboarding_version')
    .eq('user_id', userId)
    .maybeSingle()
  return data as DbUserProfile | null
}

export async function upsertUserProfile(
  userId: string,
  patch: Partial<Omit<DbUserProfile, 'user_id'>>,
): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
  if (error) console.warn('[db] upsertUserProfile:', error.message)
}

// ── Per-user competitor watchlist (watched_assets) ────────────────────────────

export async function getWatchedCompetitorIds(userId: string): Promise<string[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('watched_assets')
    .select('competitor_id')
    .eq('user_id', userId)
  return (data ?? []).map((r: { competitor_id: string }) => r.competitor_id)
}

// Bulk-replace: deletes all existing rows for the user then inserts the new set.
export async function upsertWatchedCompetitors(userId: string, competitorIds: string[]): Promise<void> {
  if (!supabase) return
  await supabase.from('watched_assets').delete().eq('user_id', userId)
  if (!competitorIds.length) return
  const { error } = await supabase
    .from('watched_assets')
    .insert(competitorIds.map(id => ({ user_id: userId, competitor_id: id })))
  if (error) console.warn('[db] upsertWatchedCompetitors:', error.message)
}

export async function addWatchedCompetitor(userId: string, competitorId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('watched_assets')
    .upsert({ user_id: userId, competitor_id: competitorId })
  if (error) console.warn('[db] addWatchedCompetitor:', error.message)
}

export async function removeWatchedCompetitor(userId: string, competitorId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('watched_assets')
    .delete()
    .match({ user_id: userId, competitor_id: competitorId })
  if (error) console.warn('[db] removeWatchedCompetitor:', error.message)
}

// ── Per-user alert read state (read_alerts) ───────────────────────────────────

export async function getReadAlertIds(userId: string): Promise<string[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('read_alerts')
    .select('alert_id')
    .eq('user_id', userId)
  return (data ?? []).map((r: { alert_id: string }) => r.alert_id)
}

export async function markAlertReadDb(userId: string, alertId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('read_alerts')
    .upsert({ user_id: userId, alert_id: alertId })
  if (error) console.warn('[db] markAlertReadDb:', error.message)
}

export async function markAlertUnreadDb(userId: string, alertId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase
    .from('read_alerts')
    .delete()
    .match({ user_id: userId, alert_id: alertId })
  if (error) console.warn('[db] markAlertUnreadDb:', error.message)
}

export async function markAllAlertsReadDb(userId: string, alertIds: string[]): Promise<void> {
  if (!supabase || !alertIds.length) return
  const rows = alertIds.map(id => ({ user_id: userId, alert_id: id }))
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await supabase
      .from('read_alerts')
      .upsert(rows.slice(i, i + 100))
    if (error) console.warn('[db] markAllAlertsReadDb:', error.message)
  }
}

// ── Per-user alert triage/handling state (alert_handling_state) ──────────────
// war-room-redesign-spec.md §7 — personal, Supabase-backed, same shape/RLS posture as
// read_alerts above. Absence of a row means 'needs_triage' (the default), so resetting
// to 'needs_triage' deletes the row rather than writing a redundant default value.

export type HandlingState = 'needs_triage' | 'in_progress' | 'handled' | 'dismissed'

export async function getHandlingStates(userId: string): Promise<Record<string, HandlingState>> {
  if (!supabase) return {}
  const { data } = await supabase
    .from('alert_handling_state')
    .select('alert_id, handling_state')
    .eq('user_id', userId)
  const out: Record<string, HandlingState> = {}
  for (const row of (data ?? []) as { alert_id: string; handling_state: HandlingState }[]) {
    out[row.alert_id] = row.handling_state
  }
  return out
}

export async function setHandlingStateDb(userId: string, alertId: string, state: HandlingState): Promise<void> {
  if (!supabase) return
  if (state === 'needs_triage') {
    const { error } = await supabase
      .from('alert_handling_state')
      .delete()
      .match({ user_id: userId, alert_id: alertId })
    if (error) console.warn('[db] setHandlingStateDb (reset):', error.message)
    return
  }
  const { error } = await supabase
    .from('alert_handling_state')
    .upsert({ user_id: userId, alert_id: alertId, handling_state: state, updated_at: new Date().toISOString() })
  if (error) console.warn('[db] setHandlingStateDb:', error.message)
}

// ── Competitor messaging snapshots (messaging_snapshots) ─────────────────────

export interface DbMessagingSnapshot {
  competitor_id: string
  content_hash:  string
  core_message:  string | null
  pillars:       string[] | null
  source_url:    string
  scraped_at:    string
}

export async function getMessagingSnapshot(competitorId: string): Promise<DbMessagingSnapshot | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('messaging_snapshots')
    .select('competitor_id, content_hash, core_message, pillars, source_url, scraped_at')
    .eq('competitor_id', competitorId)
    .maybeSingle()
  return data as DbMessagingSnapshot | null
}

export async function getMessagingSignals(competitorId: string): Promise<DbCompanySignal[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('company_signals')
    .select('id, competitor_id, signal_type, date, headline, body_excerpt, items, source_url, accession_number, why_it_matters')
    .eq('competitor_id', competitorId)
    .eq('signal_type', 'messaging_shift')
    .order('date', { ascending: false })
    .limit(10)
  return data ?? []
}
