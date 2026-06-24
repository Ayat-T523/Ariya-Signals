import { useEffect, useState } from 'react'
import { DbTrial, DbFinancialSnapshot, getAllAssets, getTrialsByAssetIds, getTrialsByCompetitorAndIndication, getRegulatoryEventsByAssetIds, getRegulatoryCalendar, getFinancialsByCompetitorId, getSignalsByCompetitorId, getHtaSignalsByCompetitorId, getDocumentsByCompetitorId, getMessagingSnapshot, getMessagingSignals, findAssetByCode } from '../lib/db'
import { cleanSignalText, buildReadableHeadline, SIGNAL_FALLBACK } from '../lib/signalText'
import { isoToYQ, trialPhaseToKey, GANTT_SKIP_STATUSES } from '../lib/trialsToGantt'

// HAE indication tags used to filter trials and assets to the user's TA.
const INDICATION_TAGS = ['hereditary angioedema', 'HAE']

// ── Helpers ───────────────────────────────────────────────────────────────────

function highestPhase(trials: DbTrial[]): string | null {
  const order  = ['PHASE4', 'PHASE3', 'PHASE2', 'PHASE1', 'EARLY_PHASE1']
  const labels: Record<string, string> = {
    PHASE4: 'Phase IV', PHASE3: 'Phase III', PHASE2: 'Phase II',
    PHASE1: 'Phase I',  EARLY_PHASE1: 'Phase I (early)',
  }
  for (const p of order) {
    if (trials.some(t => t.phase === p)) return labels[p]
  }
  return null
}

function extractTrialDesign(t: DbTrial): Record<string, string | null> | null {
  const ps = t.raw_json?.protocolSection
  if (!ps) return null

  const primaryEndpoint = ps.outcomesModule?.primaryOutcomes?.[0]?.measure ?? null

  const allocation = ps.designModule?.designInfo?.allocation
  const masking    = ps.designModule?.designInfo?.maskingInfo?.masking
  const hasPlacebo = (ps.armsInterventionsModule?.armGroups ?? [])
    .some((arm: any) => arm.type === 'PLACEBO_COMPARATOR')
  const maskLabel: Record<string, string> = {
    DOUBLE: 'double-blind', TRIPLE: 'triple-blind',
    SINGLE: 'single-blind', NONE: 'open-label',
  }
  const comparatorParts = [
    allocation === 'RANDOMIZED' ? 'Randomized' : allocation === 'NON_RANDOMIZED' ? 'Non-randomized' : null,
    masking ? (maskLabel[masking] ?? null) : null,
    hasPlacebo ? 'placebo-controlled' : null,
  ].filter(Boolean)
  const comparator = comparatorParts.length ? comparatorParts.join(', ') : null

  const minAge = ps.eligibilityModule?.minimumAge
  const maxAge = ps.eligibilityModule?.maximumAge
  const sex    = ps.eligibilityModule?.sex
  const ageStr = minAge && minAge !== 'N/A'
    ? (maxAge && maxAge !== 'N/A' ? `Ages ${minAge}–${maxAge}` : `Ages ${minAge}+`)
    : null
  const sexStr = sex === 'MALE' ? 'male only' : sex === 'FEMALE' ? 'female only' : null
  const patientPopulation = [ageStr, sexStr].filter(Boolean).join(', ') || null

  const count = ps.designModule?.enrollmentInfo?.count
  const type  = ps.designModule?.enrollmentInfo?.type
  const sampleSize = count != null
    ? `${count.toLocaleString()}${type === 'ESTIMATED' ? ' (estimated)' : type === 'ACTUAL' ? ' (actual)' : ''}`
    : null

  if (!primaryEndpoint && !comparator && !patientPopulation && !sampleSize) return null
  return { primaryEndpoint, comparator, patientPopulation, sampleSize }
}

function buildDataSummary(
  name: string,
  pipeline: any[],
  products: any[],
  keyEvents: any[],
): string | null {
  const parts: string[] = []

  // Marketed products
  const marketed = products.filter((p: any) => p.mechanism)
  if (marketed.length) {
    const list = marketed
      .map((p: any) => `${p.name} (${p.mechanism}${p.approvalYear ? `, approved ${p.approvalYear}` : ''})`)
      .join(' and ')
    parts.push(`${name} markets ${list}.`)
  }

  // Pipeline programs with phase and mechanism
  const active = pipeline.filter((a: any) => a.mechanism && a.phase)
  if (active.length) {
    const list = active
      .slice(0, 2)
      .map((a: any) => `${a.name} (${a.phase}, ${a.mechanism})`)
      .join('; ')
    parts.push(`Pipeline: ${list}.`)
  }

  // Best trial brief summary (first non-illustrative one found)
  const trialText = pipeline
    .map((a: any) => a.trialDesignSummary as string | undefined)
    .find(s => s && !s.toLowerCase().includes('illustrative'))
  if (trialText) {
    const sentence = trialText.split(/\.[\s]/)[0].trim()
    parts.push(sentence.endsWith('.') ? sentence : sentence + '.')
  }

  // Recent regulatory event if available
  const recentApproval = (keyEvents ?? []).find((e: any) => e._live && e.type === 'regulatory')
  if (recentApproval?.headline) {
    parts.push(recentApproval.headline + '.')
  }

  return parts.length >= 2 ? parts.join(' ') : null
}

// ── Financial helpers ─────────────────────────────────────────────────────────

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' }

function formatRevenue(usd: number | null, rawVal: number | null, currency: string): string {
  // Prefer USD-converted value for display; fall back to raw with currency symbol
  const val  = usd ?? rawVal
  const sym  = usd != null ? '$' : (CURRENCY_SYMBOLS[currency] ?? '')
  const denom = usd != null
    ? (val! >= 1e9 ? 1e9 : 1e6)
    : (currency === 'JPY' ? 1e9 : 1e6)
  const unit  = usd != null
    ? (val! >= 1e9 ? 'B' : 'M')
    : (currency === 'JPY' ? 'B' : 'M')

  if (val == null) return '—'
  const display = val / denom
  return `${sym}${display >= 100 ? display.toFixed(0) : display.toFixed(1)}${unit}`
}

function computeDelta(current: number | null, prior: number | null): string | null {
  if (current == null || prior == null || prior === 0) return null
  const pct = ((current - prior) / Math.abs(prior)) * 100
  const arrow = pct >= 0 ? '↑' : '↓'
  return `${arrow} ${Math.abs(pct).toFixed(0)}% vs prior FY`
}

function buildLiveFinancials(snapshots: DbFinancialSnapshot[]): Record<string, unknown> | null {
  if (!snapshots.length) return null
  const latest = snapshots[0]
  const prior  = snapshots[1] ?? null

  // HAE revenue: use live figure if available (GNW source), otherwise note not reported
  const haeRevenue = latest.hae_revenue_usd != null
    ? formatRevenue(latest.hae_revenue_usd, null, 'USD')
    : 'Not reported separately'
  const haeRevenueDelta = latest.hae_revenue_usd != null && prior?.hae_revenue_usd != null
    ? computeDelta(latest.hae_revenue_usd, prior.hae_revenue_usd)
    : null

  return {
    totalRevenue:          formatRevenue(latest.total_revenue_usd, latest.total_revenue_raw, latest.currency),
    totalRevenueDelta:     computeDelta(latest.total_revenue_usd, prior?.total_revenue_usd ?? null),
    rdSpend:               formatRevenue(latest.rd_expense_usd, latest.rd_expense_raw, latest.currency),
    rdSpendDelta:          computeDelta(latest.rd_expense_usd, prior?.rd_expense_usd ?? null),
    haeRevenue,
    haeRevenueDelta,
    haeRdAllocation:       '—',
    _financialsSource:     'sec_edgar',
    _financialsFiscalYear: latest.fiscal_year,
    _financialsCurrency:   latest.currency,
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCompetitorSupabase(competitor: any) {
  const [augmented, setAugmented] = useState(competitor)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const allAssets = await getAllAssets()
      if (cancelled || !allAssets.length) return

      const matchedAssets = new Map<string, typeof allAssets[0]>()
      const pipelineCodes = (competitor.pipeline        ?? []).map((a: any) => a.assetInn ?? a.assetId)
      const productNames  = (competitor.marketedProducts ?? []).map((p: any) => p.molecule)

      for (const code of [...pipelineCodes, ...productNames]) {
        const asset = findAssetByCode(code, allAssets)
        if (asset) matchedAssets.set(asset.id, asset)
      }

      const assetIds = [...matchedAssets.keys()]
      const [trials, indicationTrials, regEvents, financials, signals, htaSignals, calendarEvents, documents, messagingSnap, messagingSignals] = await Promise.all([
        getTrialsByAssetIds(assetIds),
        // Phase 2.5: supplementary path — catches trials for assets matched via indication_tags
        // rather than stub pipeline code lookup. Deduped by NCT ID below.
        getTrialsByCompetitorAndIndication(competitor.id, INDICATION_TAGS),
        getRegulatoryEventsByAssetIds(assetIds),
        getFinancialsByCompetitorId(competitor.id),
        getSignalsByCompetitorId(competitor.id),
        getHtaSignalsByCompetitorId(competitor.id),
        getRegulatoryCalendar(),
        getDocumentsByCompetitorId(competitor.id),
        getMessagingSnapshot(competitor.id),
        getMessagingSignals(competitor.id),
      ])
      if (cancelled) return

      // Merge: asset-matched trials first, then any indication-filtered trials not already fetched
      const nctSeen = new Set(trials.map((t: DbTrial) => t.nct_id))
      const mergedTrials = [
        ...trials,
        ...indicationTrials.filter((t: DbTrial) => !nctSeen.has(t.nct_id)),
      ]

      const trialsByAsset = new Map<string, typeof mergedTrials>()
      for (const t of mergedTrials) {
        if (!trialsByAsset.has(t.asset_id)) trialsByAsset.set(t.asset_id, [])
        trialsByAsset.get(t.asset_id)!.push(t)
      }

      // ── Augment pipeline[] ────────────────────────────────────────────────
      const augPipeline = (competitor.pipeline ?? []).map((asset: any) => {
        const dbAsset = findAssetByCode(asset.assetInn ?? asset.assetId, allAssets)
        if (!dbAsset) return asset

        const assetTrials = trialsByAsset.get(dbAsset.id) ?? []

        const bestTrial =
          assetTrials.find(t => t.phase === 'PHASE3' && t.status === 'RECRUITING') ??
          assetTrials.find(t => t.status === 'RECRUITING') ??
          assetTrials.find(t => t.status !== 'COMPLETED') ??
          assetTrials[0] ??
          null

        const realTrialDesign = bestTrial ? extractTrialDesign(bestTrial) : null
        const realPhase       = highestPhase(assetTrials)

        const cleanName = asset.name.replace(/\s*\(illustrative[^)]*\)/gi, '').trim()
        const realName  = !cleanName.toLowerCase().includes(dbAsset.inn.toLowerCase())
          ? `${cleanName} (${dbAsset.inn.charAt(0).toUpperCase() + dbAsset.inn.slice(1)})`
          : cleanName

        // ── Gantt bars from live trial dates (A7) ───────────────────────────
        const ganttTrials = assetTrials
          .filter(t => !GANTT_SKIP_STATUSES.has((t.status ?? '').toUpperCase().replace(/\s+/g, '_')))
          .filter(t => t.start_date != null)
          .sort((a: DbTrial, b: DbTrial) => {
            const rank: Record<string, number> = { PHASE3: 3, PHASE2: 2, PHASE1: 1 }
            const aKey = Object.keys(rank).find(k => (a.phase ?? '').toUpperCase().includes(k)) ?? 'PHASE1'
            const bKey = Object.keys(rank).find(k => (b.phase ?? '').toUpperCase().includes(k)) ?? 'PHASE1'
            return (rank[bKey] ?? 1) - (rank[aKey] ?? 1)
          })

        const ganttBars = ganttTrials
          .slice(0, 2)
          .map((t: DbTrial) => {
            const start = isoToYQ(t.start_date as string)
            const end   = isoToYQ((t.completion_date ?? t.start_date) as string)
            if (!start) return null
            return {
              sy: start.y, sq: start.q,
              ey: (end ?? start).y, eq: (end ?? start).q,
              phase: trialPhaseToKey(t.phase),
            }
          })
          .filter((b): b is NonNullable<typeof b> => b !== null)

        const ganttMilestones = ganttTrials
          .slice(0, 2)
          .flatMap((t: DbTrial) => {
            const pcdDate = (t.raw_json as any)
              ?.protocolSection?.statusModule?.primaryCompletionDateStruct?.date
            const pcd = isoToYQ(pcdDate)
            if (!pcd) return []
            return [{ y: pcd.y, q: pcd.q, type: 'readout' as const, label: 'PCD' }]
          })

        return {
          ...asset,
          name:         realName,
          _trialSource: bestTrial ? 'ctgov' : 'illustrative',
          ...(dbAsset.mechanism        ? { mechanism: dbAsset.mechanism }                              : {}),
          ...(bestTrial?.brief_summary ? { trialDesignSummary: bestTrial.brief_summary }               : {}),
          ...(realTrialDesign          ? { trialDesign: { ...asset.trialDesign, ...realTrialDesign } } : {}),
          ...(realPhase                ? { phase: realPhase }                                          : {}),
          trialIds:        assetTrials.slice(0, 5).map(t => t.nct_id),
          ...(ganttBars.length > 0 ? { _ganttBars: ganttBars, _ganttMilestones: ganttMilestones } : {}),
        }
      })

      // ── Augment marketedProducts[] ────────────────────────────────────────
      const augProducts = (competitor.marketedProducts ?? []).map((product: any) => {
        const dbAsset = findAssetByCode(product.molecule, allAssets)
        if (!dbAsset) return product

        const approvalYear = dbAsset.approval_date
          ? new Date(dbAsset.approval_date).getFullYear()
          : null

        return {
          ...product,
          ...(dbAsset.mechanism            ? { mechanism:    dbAsset.mechanism }              : {}),
          ...(approvalYear                 ? { approvalYear }                                 : {}),
          ...(dbAsset.manufacturer_current ? { manufacturer: dbAsset.manufacturer_current }  : {}),
        }
      })

      // ── Augment keyEvents with FDA approval events ────────────────────────
      const approvalEvents = regEvents
        .filter(e => e.event_type === 'approval')
        .map(e => ({
          date:     e.date ?? '',
          type:     'regulatory',
          source:   e.authority,
          headline: e.headline,
          summary:  e.details ?? '',
          _live:    true,
        }))

      const today = new Date()
      const emaEvents = calendarEvents
        .filter(e => {
          if (!e.start_date) return false
          return new Date(e.start_date) >= today
        })
        .slice(0, 3)
        .map(e => ({
          date:      e.start_date ?? '',
          type:      'regulatory',
          source:    'EMA',
          headline:  e.title ?? `EMA ${e.event_type} Committee Meeting`,
          summary:   'Upcoming EMA committee meeting. Drug approvals, safety reviews, and designations across all therapeutic areas may be discussed.',
          _live:     true,
          sourceUrl: e.source_url ?? undefined,
        }))

      // ── HTA decisions (NICE) → regulatory key events ──────────────────────
      // hta_decision signals carry no date filter (getSignalsByCompetitorId), so
      // historical TA decisions (e.g. TA738 / 2021) surface here even though they
      // fall outside the War Room's 90-day "recent" window.
      const liveHtaEvents = htaSignals
        .map((s: any) => ({
          date:      s.date ?? '',
          type:      'regulatory',
          source:    'NICE',
          headline:  buildReadableHeadline(s, competitor.name),
          summary:   s.body_excerpt ?? '',
          _live:     true,
          sourceUrl: s.source_url ?? undefined,
        }))

      const existingHeadlines = new Set([...approvalEvents, ...emaEvents, ...liveHtaEvents].map(e => e.headline.toLowerCase()))
      const filteredStubEvents = (competitor.keyEvents ?? []).filter(
        (e: any) => !existingHeadlines.has((e.headline ?? '').toLowerCase())
      )

      const mergedEvents = [...approvalEvents, ...emaEvents, ...liveHtaEvents, ...filteredStubEvents]
      const dataSummary  = buildDataSummary(competitor.name, augPipeline, augProducts, mergedEvents)

      // ── Financials from SEC EDGAR ─────────────────────────────────────────
      const liveFinancials = buildLiveFinancials(financials)

      // ── Strategic signals from 8-K ────────────────────────────────────────

      const liveDeals = signals
        .filter((s: any) => s.signal_type === 'deal')
        .map((s: any) => ({
          date:         s.date,
          headline:     cleanSignalText(s),
          whyItMatters: s.why_it_matters ?? null,
          _live:        true,
          sourceUrl:    s.source_url,
        }))

      const liveHiring = signals
        .filter((s: any) => s.signal_type === 'exec_change')
        .map((s: any) => ({
          date:      s.date,
          headline:  buildReadableHeadline(s, competitor.name),
          _live:     true,
          sourceUrl: s.source_url,
        }))
        .filter((h: any) => h.headline !== SIGNAL_FALLBACK)
        .slice(0, 5)

      const recentPersonnelChanges = liveHiring

      const recentPressReleases = signals
        .filter((s: any) => s.signal_type === 'press_release')
        .map((s: any) => ({
          date:             s.date,
          headline:         cleanSignalText(s),
          _live:            true,
          sourceUrl:        s.source_url,
          accession_number: s.accession_number ?? null,
        }))
        .filter((p: any) => p.headline !== SIGNAL_FALLBACK)
        .slice(0, 5)

      // Merge live signals with stub data (live first)
      const mergedDeals   = [...liveDeals,   ...(competitor.strategicSignals?.deals  ?? [])]
      const mergedHiring  = [...liveHiring,  ...(competitor.strategicSignals?.hiring ?? [])]

      // ── Live messaging from messaging_snapshots ────────────────────────────
      // If a snapshot exists, build a live messaging object for MessagingTab.
      // Falls back to the static JSON value when no snapshot has been seeded yet.
      const liveMessaging = messagingSnap && messagingSnap.core_message
        ? {
            currentCoreMessage:   messagingSnap.core_message,
            messagePillars:       (messagingSnap.pillars as string[] | null) ?? [],
            currentMessageSource: messagingSnap.source_url,
            timeline: messagingSignals.map((s: any) => ({
              date:          s.date ?? '',
              sourceType:    'Website copy',
              headline:      s.headline ?? '',
              detail:        s.body_excerpt ?? '',
              shiftDetected: true,
              whyItMatters:  s.why_it_matters ?? null,
            })),
            vsPharmaInc: competitor.messaging?.vsPharmaInc ?? [],
          }
        : (competitor.messaging ?? null)

      setAugmented({
        ...competitor,
        pipeline:          augPipeline,
        marketedProducts:  augProducts,
        keyEvents:         mergedEvents,
        ...(liveFinancials ? { financials: { ...competitor.financials, ...liveFinancials } } : {}),
        strategicSignals: {
          ...(competitor.strategicSignals ?? {}),
          deals:  mergedDeals,
          hiring: mergedHiring,
        },
        recentPersonnelChanges,
        recentPressReleases,
        sourceDocs: documents,
        messaging:  liveMessaging,
        ...(dataSummary ? { executiveSummary: dataSummary, _summaryGenerated: true } : {}),
      })
    }

    load()
    return () => { cancelled = true }
  }, [competitor.id])

  return augmented
}
