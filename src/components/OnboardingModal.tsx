import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { ASSETS_CONFIG, getAssetById, type AssetConfig } from '../config/assets-config'
import { competitorsData } from '../data/kalvista'
import { useChemblSearch, type ChemblHit } from '../hooks/useChemblSearch'
import { supabase } from '../lib/supabase'

// ── Indication constraint map ─────────────────────────────────────────────────
// All assets within an indication share lexiconInns and lexiconTaTerms.
// First entry per indication is representative.

type IndicationConfig = Pick<
  AssetConfig,
  'indication' | 'indicationFull' | 'lexiconInns' | 'lexiconTaTerms' | 'suggestedCompetitors'
>

const INDICATION_CONFIGS = new Map<string, IndicationConfig>()
for (const a of ASSETS_CONFIG) {
  if (!INDICATION_CONFIGS.has(a.indication)) INDICATION_CONFIGS.set(a.indication, a)
}

// Returns the curated indication config if the ChEMBL hit's INN or any synonym
// appears in that indication's lexiconInns. Returns null when out of scope.
function resolveIndication(hit: ChemblHit): IndicationConfig | null {
  const terms = new Set([hit.inn, ...hit.synonyms].map(s => s.toLowerCase()))
  for (const [, cfg] of INDICATION_CONFIGS) {
    if (cfg.lexiconInns.some(lex => terms.has(lex.toLowerCase()))) return cfg
  }
  return null
}

// When a ChEMBL hit's INN or synonyms match an existing ASSETS_CONFIG entry,
// return that entry so we reuse its id and full config rather than creating a
// synthetic asset.
function findStaticAsset(hit: ChemblHit): AssetConfig | undefined {
  const terms = [hit.inn, ...hit.synonyms].map(s => s.toLowerCase())
  return ASSETS_CONFIG.find(a => terms.includes(a.innName.toLowerCase()))
}

// Upsert the resolved ChEMBL entity into asset_lexicon. Fire-and-forget —
// upsert is enrichment only; onboarding is never blocked by its outcome.
// mechanism and first_approval are not returned by /api/chembl/search, so
// they are left null (the seed script fills them for curated assets).
async function upsertToLexicon(hit: ChemblHit): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('asset_lexicon').upsert({
    inn:        hit.inn,
    brand_name: null,
    chembl_id:  hit.chembl_id,
    synonyms:   hit.synonyms,
    max_phase:  hit.max_phase,
    mechanism:  null,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'inn' })
  if (error) {
    console.warn('[OnboardingModal] asset_lexicon upsert (non-critical):', error.message)
  }
}

// ── Competitor pills ──────────────────────────────────────────────────────────

const selectableCompetitors = (competitorsData as Array<{ id: string; name: string; status?: string }>)
  .filter(c => c.status !== 'acquired')

// Strip data-quality annotations that should never appear in product UI.
function stripAnnotations(s: string): string {
  return s.replace(/\s*\((illustrative[^)]*|literature|hypothetical|TBD)\)/gi, '').trim()
}

function competitorPills(id: string): { label: string; title: string }[] {
  const c = (competitorsData as any[]).find(x => x.id === id)
  if (!c) return []

  const marketed = ((c.marketedProducts ?? []) as Array<{ name: string; molecule?: string; approvalYear?: number }>)
    .slice()
    .sort((a, b) => (b.approvalYear ?? 0) - (a.approvalYear ?? 0))
    .map(p => {
      const name = stripAnnotations(p.name)
      const mol  = stripAnnotations(p.molecule ?? '')
      const isDup = mol !== '' && name.toLowerCase().includes(mol.toLowerCase())
      return { label: name, title: isDup ? name : (mol ? `${name} (${mol})` : name) }
    })

  const pipeline = ((c.pipeline ?? []) as Array<{ name: string; assetInn?: string }>)
    .map(p => {
      const name = stripAnnotations(p.name)
      const inn  = stripAnnotations(p.assetInn ?? '')
      const isDup = inn !== '' && name.toLowerCase().includes(inn.toLowerCase())
      return { label: name, title: isDup ? name : (inn ? `${name} (${inn})` : name) }
    })

  return marketed.length >= 2 ? marketed : [...marketed, ...pipeline]
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingModal() {
  const {
    setUserIndication, setUserAssetName, setUserAssetId,
    resetWatchedCompetitors,
    completeOnboarding, closeOnboarding, startTour,
  } = useApp()
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState<1 | 2>(1)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [chemblSelection, setChemblSelection] = useState<{
    hit: ChemblHit
    indication: string
    indicationFull: string
    lexiconTaTerms: string[]
    suggestedCompetitors: string[]
  } | null>(null)
  const [assetSearch, setAssetSearch] = useState('')
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<string[]>([])

  // Live ChEMBL search — active when the user has typed ≥2 chars
  const { hits, loading, error: searchError } = useChemblSearch(assetSearch)
  const showLive = assetSearch.length >= 2

  // Static fallback list — used when showLive=false or ChEMBL fails/empty
  const filteredAssets = ASSETS_CONFIG.filter(a =>
    assetSearch === '' ||
    a.brandName.toLowerCase().includes(assetSearch.toLowerCase()) ||
    a.innName.toLowerCase().includes(assetSearch.toLowerCase())
  )

  // Partition live hits into curated-indication-matched and out-of-scope groups
  const inScopeGroups = new Map<string, { cfg: IndicationConfig; hits: ChemblHit[] }>()
  const outOfScopeHits: ChemblHit[] = []
  if (showLive && !loading && !searchError && hits.length > 0) {
    for (const hit of hits) {
      const resolved = resolveIndication(hit)
      if (resolved) {
        const key = resolved.indication
        if (!inScopeGroups.has(key)) inScopeGroups.set(key, { cfg: resolved, hits: [] })
        inScopeGroups.get(key)!.hits.push(hit)
      } else {
        outOfScopeHits.push(hit)
      }
    }
  }

  // Unified selected asset: either a static ASSETS_CONFIG entry or a synthetic
  // asset built from a ChEMBL hit + its matched indication config.
  const selectedAsset: AssetConfig | undefined =
    selectedAssetId
      ? getAssetById(selectedAssetId)
      : chemblSelection
        ? {
            id:                   chemblSelection.hit.inn,
            brandName:            chemblSelection.hit.inn,
            innName:              chemblSelection.hit.inn,
            indication:           chemblSelection.indication,
            indicationFull:       chemblSelection.indicationFull,
            suggestedCompetitors: chemblSelection.suggestedCompetitors,
            lexiconInns:          [],
            lexiconTaTerms:       chemblSelection.lexiconTaTerms,
          }
        : undefined

  function handleStaticSelect(id: string) {
    setSelectedAssetId(id)
    setChemblSelection(null)
  }

  function handleChemblSelect(hit: ChemblHit) {
    const resolved = resolveIndication(hit)
    if (!resolved) return  // unreachable: out-of-scope buttons have no onClick

    const staticMatch = findStaticAsset(hit)
    if (staticMatch) {
      setSelectedAssetId(staticMatch.id)
      setChemblSelection(null)
    } else {
      setChemblSelection({ hit, ...resolved })
      setSelectedAssetId(null)
    }
    void upsertToLexicon(hit)
  }

  function isHitSelected(hit: ChemblHit): boolean {
    if (selectedAssetId) {
      const staticMatch = findStaticAsset(hit)
      return !!(staticMatch && staticMatch.id === selectedAssetId)
    }
    return chemblSelection?.hit.inn === hit.inn
  }

  function savePreferences() {
    if (selectedAsset) {
      setUserIndication(selectedAsset.indication)
      setUserAssetName(selectedAsset.brandName)
      setUserAssetId(selectedAsset.id)
      const toWrite = selectedCompetitorIds.length > 0
        ? selectedCompetitorIds
        : selectedAsset.suggestedCompetitors
      resetWatchedCompetitors(toWrite)
    }
  }

  function handleNext() {
    if (step === 1 && selectedAsset) {
      setSelectedCompetitorIds(selectedAsset.suggestedCompetitors)
      setStep(2)
    }
  }

  function handleBack() {
    if (step === 2) setStep(1)
  }

  function handleStartTour() {
    savePreferences()
    startTour()
  }

  function handleSkip() {
    savePreferences()
    completeOnboarding([])
    closeOnboarding()
    navigate('/')
  }

  function toggleCompetitor(id: string) {
    setSelectedCompetitorIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  useEffect(() => { dialogRef.current?.focus() }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleSkip()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedAssetId, selectedCompetitorIds])

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return
      const focusable = el.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable.length) return
      const first = focusable[0]
      const last  = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last)  { e.preventDefault(); first.focus() }
      }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [])

  const stepTitles = [
    'Which asset are you tracking?',
    'Confirm your competitor watchlist.',
  ]
  const stepSubtitles = [
    "We'll pre-configure your signals feed and relevance filter.",
    'These are pre-selected based on your asset. Deselect or add others — you can change this any time.',
  ]

  const nextDisabled = step === 1 && !selectedAsset

  const nextLabel = step === 1 && !selectedAsset ? 'Select an asset to continue' : 'Next →'

  // Status line below the search input
  const statusText = (() => {
    if (showLive) {
      if (loading) return 'Searching ChEMBL…'
      if (searchError) return ''
      if (hits.length === 0) return `No results in ChEMBL for "${assetSearch}"`
      const n = hits.filter(h => resolveIndication(h) !== null).length
      if (n === 0) return 'Results found — none in curated indications (HAE, PNH, PBC)'
      return `${n} result${n !== 1 ? 's' : ''} in curated indications`
    }
    if (assetSearch === '') return ''
    if (filteredAssets.length === 0) return 'No products match your search'
    return `${filteredAssets.length} result${filteredAssets.length !== 1 ? 's' : ''} found`
  })()

  // Shared style for indication group headings
  const indicationHeadingStyle: React.CSSProperties = {
    margin: '4px 0 0',
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'rgba(5,10,68,0.40)',
  }

  // Renders a static ASSETS_CONFIG card (used in browse mode and fallback)
  function StaticAssetCard({ asset }: { asset: AssetConfig }) {
    const isSelected = selectedAssetId === asset.id
    return (
      <button
        key={asset.id}
        type="button"
        role="radio"
        aria-checked={isSelected}
        onClick={() => handleStaticSelect(asset.id)}
        style={{
          textAlign: 'left',
          border: isSelected ? '2px solid #050A44' : '1.5px solid rgba(5,10,68,0.12)',
          borderRadius: '12px',
          padding: '14px 16px',
          background: isSelected ? 'rgba(5,10,68,0.03)' : '#FFFFFF',
          cursor: 'pointer',
          transition: 'border-color 150ms ease, background 150ms ease',
          width: '100%',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
          <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
            {asset.brandName}
          </p>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.50)', fontStyle: 'italic' }}>
            {asset.innName}
          </p>
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.55)' }}>
          {asset.indicationFull}
        </p>
      </button>
    )
  }

  // Renders the static ASSETS_CONFIG list grouped by indication
  function StaticGroupedList({ assets }: { assets: AssetConfig[] }) {
    if (assets.length === 0) {
      return (
        <p style={{ fontSize: '14px', color: 'rgba(5,10,68,0.45)', textAlign: 'center', padding: '20px 0', margin: 0 }}>
          No assets match your search.
        </p>
      )
    }
    return (
      <>
        {(['HAE', 'PNH', 'PBC'] as const)
          .map(ind => ({ indication: ind, assets: assets.filter(a => a.indication === ind) }))
          .filter(g => g.assets.length > 0)
          .map(group => (
            <div key={group.indication} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={indicationHeadingStyle}>
                {group.indication} — {group.assets[0].indicationFull}
              </p>
              {group.assets.map(asset => (
                <StaticAssetCard key={asset.id} asset={asset} />
              ))}
            </div>
          ))}
      </>
    )
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(5,10,68,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        tabIndex={-1}
        style={{
          background: '#FFFFFF', borderRadius: '20px',
          width: '100%', maxWidth: '560px',
          maxHeight: '90vh', overflowY: 'auto',
          padding: '40px',
          boxShadow: '0 24px 80px rgba(5,10,68,0.22)',
          outline: 'none',
        }}
      >
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '28px' }}>
          {([1, 2] as const).map((s) => (
            <div key={s} style={{
              height: '3px', flex: 1, borderRadius: '2px',
              background: s <= step ? '#050A44' : 'rgba(5,10,68,0.12)',
              transition: 'background 200ms ease',
            }} />
          ))}
        </div>

        <h2
          id="onboarding-title"
          style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: 'rgba(5,10,68,0.92)', lineHeight: 1.25 }}
        >
          {stepTitles[step - 1]}
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.55' }}>
          {stepSubtitles[step - 1]}
        </p>

        {/* ── Step 1: Asset selection ── */}
        {step === 1 && (
          <div style={{ marginBottom: '24px' }}>
            <input
              type="search"
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              placeholder="Search by brand name or INN…"
              style={{
                width: '100%', boxSizing: 'border-box',
                border: '1.5px solid rgba(5,10,68,0.20)', borderRadius: '10px',
                padding: '11px 14px', fontSize: '14px', fontFamily: 'inherit',
                outline: 'none', color: 'rgba(5,10,68,0.92)',
                marginBottom: '12px',
              }}
              autoFocus
            />

            {statusText && (
              <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontFamily: 'inherit' }}>
                {statusText}
              </p>
            )}

            {/* ── Live ChEMBL results (≥2 chars) ── */}
            {showLive ? (
              loading ? (
                <div style={{ padding: '24px 0', textAlign: 'center' }}>
                  <p style={{ margin: 0, fontSize: '14px', color: 'rgba(5,10,68,0.40)' }}>
                    Searching ChEMBL…
                  </p>
                </div>
              ) : searchError || hits.length === 0 ? (
                // Error or no results: fall back to filtered static list
                <div role="radiogroup" aria-label="Asset" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <StaticGroupedList assets={filteredAssets} />
                </div>
              ) : (
                // Live results: in-scope selectable + out-of-scope dimmed
                <div role="radiogroup" aria-label="Asset" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  {/* In-scope hits grouped by indication */}
                  {[...inScopeGroups.entries()].map(([ind, { cfg, hits: groupHits }]) => (
                    <div key={ind} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <p style={indicationHeadingStyle}>
                        {ind} — {cfg.indicationFull}
                      </p>
                      {groupHits.map(hit => {
                        const isSelected = isHitSelected(hit)
                        return (
                          <button
                            key={hit.inn}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => handleChemblSelect(hit)}
                            style={{
                              textAlign: 'left',
                              border: isSelected ? '2px solid #050A44' : '1.5px solid rgba(5,10,68,0.12)',
                              borderRadius: '12px',
                              padding: '14px 16px',
                              background: isSelected ? 'rgba(5,10,68,0.03)' : '#FFFFFF',
                              cursor: 'pointer',
                              transition: 'border-color 150ms ease, background 150ms ease',
                              width: '100%',
                              fontFamily: 'inherit',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                              <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
                                {hit.inn}
                              </p>
                              {hit.max_phase !== null && (
                                <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.45)' }}>
                                  Phase {hit.max_phase}
                                </p>
                              )}
                            </div>
                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.55)' }}>
                              {cfg.indicationFull}
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  ))}

                  {/* Out-of-scope hits — dimmed, non-selectable */}
                  {outOfScopeHits.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: inScopeGroups.size > 0 ? '4px' : 0 }}>
                      <p style={{ ...indicationHeadingStyle, color: 'rgba(5,10,68,0.28)' }}>
                        Not in curated indications
                      </p>
                      {outOfScopeHits.map(hit => (
                        <div
                          key={hit.inn}
                          aria-disabled="true"
                          title={`${hit.inn} is not in a curated indication (HAE, PNH, PBC)`}
                          style={{
                            textAlign: 'left',
                            border: '1.5px solid rgba(5,10,68,0.08)',
                            borderRadius: '12px',
                            padding: '14px 16px',
                            background: 'rgba(5,10,68,0.02)',
                            cursor: 'not-allowed',
                            opacity: 0.5,
                            fontFamily: 'inherit',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
                            <p style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.60)' }}>
                              {hit.inn}
                            </p>
                            {hit.max_phase !== null && (
                              <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>
                                Phase {hit.max_phase}
                              </p>
                            )}
                          </div>
                          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic' }}>
                            Not yet covered — not in a curated indication
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              // ── Static list: full when empty, filtered when typing ──
              <div role="radiogroup" aria-label="Asset" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <StaticGroupedList assets={filteredAssets} />
              </div>
            )}

            {/* Indication confirmation strip */}
            {selectedAsset && (
              <div style={{
                marginTop: '14px',
                padding: '10px 14px',
                background: 'rgba(5,10,68,0.04)',
                borderRadius: '8px',
                border: '1px solid rgba(5,10,68,0.08)',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.50)' }}>Indication</span>
                <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.80)', fontWeight: 600 }}>
                  {selectedAsset.indicationFull}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Competitor confirmation ── */}
        {step === 2 && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {selectableCompetitors.map((competitor) => {
                const isSelected = selectedCompetitorIds.includes(competitor.id)
                const pills = competitorPills(competitor.id)
                return (
                  <button
                    key={competitor.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggleCompetitor(competitor.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '9px 10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isSelected ? 'rgba(5,10,68,0.05)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                      width: '100%',
                    }}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: '16px', height: '16px', flexShrink: 0,
                      borderRadius: '4px',
                      border: isSelected ? '2px solid #050A44' : '1.5px solid rgba(5,10,68,0.28)',
                      background: isSelected ? '#050A44' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && (
                        <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
                          <path d="M1 3.5L3 5.5L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    {/* Name */}
                    <span style={{
                      fontSize: '14px', fontWeight: 600,
                      color: 'rgba(5,10,68,0.85)',
                      width: '160px', flexShrink: 0,
                    }}>
                      {competitor.name}
                    </span>
                    {/* Products */}
                    <span style={{
                      fontSize: '12px', color: 'rgba(5,10,68,0.40)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      flex: 1,
                    }}>
                      {pills.map(p => p.label).join('  ·  ')}
                    </span>
                  </button>
                )
              })}
            </div>
            <p style={{ margin: '14px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.50)', minHeight: '18px' }}>
              {selectedCompetitorIds.length === 0
                ? 'Select at least one competitor to populate your War Room.'
                : `${selectedCompetitorIds.length} competitor${selectedCompetitorIds.length !== 1 ? 's' : ''} selected — you can adjust these any time.`}
            </p>
          </div>
        )}

        {/* ── Navigation ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {step < 2 ? (
            <button
              onClick={handleNext}
              disabled={nextDisabled}
              style={{
                width: '100%',
                background: nextDisabled ? 'rgba(5,10,68,0.20)' : '#050A44',
                color: '#FFFFFF', border: 'none', borderRadius: '10px',
                padding: '14px', fontSize: '15px', fontWeight: 600,
                cursor: nextDisabled ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em', fontFamily: 'inherit',
                transition: 'background 150ms ease',
              }}
            >
              {nextLabel}
            </button>
          ) : (
            <button
              onClick={handleStartTour}
              disabled={selectedCompetitorIds.length === 0}
              style={{
                width: '100%',
                background: selectedCompetitorIds.length === 0 ? 'rgba(5,10,68,0.20)' : '#050A44',
                color: '#FFFFFF', border: 'none', borderRadius: '10px',
                padding: '14px', fontSize: '15px', fontWeight: 600,
                cursor: selectedCompetitorIds.length === 0 ? 'not-allowed' : 'pointer',
                letterSpacing: '-0.01em', fontFamily: 'inherit',
                transition: 'background 150ms ease',
              }}
            >
              Start tour →
            </button>
          )}

          {step > 1 && (
            <button
              onClick={handleBack}
              style={{
                width: '100%', background: 'none',
                border: '1.5px solid rgba(5,10,68,0.15)', borderRadius: '10px',
                padding: '13px', fontSize: '14px', fontWeight: 500,
                color: 'rgba(5,10,68,0.65)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              ← Back
            </button>
          )}

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
                fontSize: '13px', color: 'rgba(5,10,68,0.65)', fontFamily: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Skip and go straight to my War Room
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
