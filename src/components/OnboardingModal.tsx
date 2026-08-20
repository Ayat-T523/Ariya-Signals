import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './shadcn/ui/dialog'
import { Button } from './shadcn/ui/button'
import EmptyState from './ui/EmptyState'
import { THERAPEUTIC_AREAS } from '../config/therapeutic-areas'
import {
  type LandscapeConfiguration,
  getDiseaseAreasForTherapeuticArea,
  getAssetsForDiseaseArea,
  applyTherapeuticAreaSelection,
  applyDiseaseAreaSelection,
  applyHomeAssetSelection,
  isLandscapeConfigurationSubmittable,
} from '../config/landscape-configuration'

/**
 * OnboardingModal.tsx — "Define your landscape" (Frontend Step 3 of 7).
 *
 * Replaces the old asset-first onboarding (static/live-ChEMBL asset search ->
 * a static-competitor-confirm step seeded from AssetConfig.suggestedCompetitors
 * and the HAE-only competitor universe in src/data/kalvista.ts). That second
 * step is not backend landscape discovery, isn't valid for arbitrary
 * Therapeutic Area / Disease Area combinations, and is intentionally not
 * carried forward — see landscape-configuration.ts and product contract
 * Step 9. Competitor discovery begins in Frontend Step 4.
 *
 * One compact screen, hierarchical: Therapeutic Area -> Disease Area -> Home
 * Asset. Changing an upstream choice clears everything downstream
 * (applyTherapeuticAreaSelection / applyDiseaseAreaSelection in
 * landscape-configuration.ts, unit-tested there) rather than leaving a stale
 * selection hidden in state.
 *
 * Live ChEMBL search is deliberately not offered here: a ChEMBL hit has no
 * deterministic diseaseAreaId unless it happens to match an existing
 * AssetConfig entry by INN, and letting an undeterminable result bypass the
 * canonical model is exactly what product contract Step 7 forbids. Home
 * Asset is catalog-only for this step; live search can return once there's a
 * real mechanism for a live result to carry a trustworthy Disease Area.
 *
 * Modal shell is shadcn's Dialog (Radix underneath) instead of the old
 * hand-rolled createPortal + manual focus-trap + manual Escape listener --
 * real focus trap, Escape-to-close, and aria-modal semantics for free, and
 * it's the same component AskModal.tsx already uses elsewhere in this app.
 * No Select/Combobox/Stepper exists anywhere in this codebase (shadcn,
 * Animate UI, or Kokonut) to reuse for the three pickers below; the app's own
 * existing convention for "pick one from a short list" -- the role="radio"
 * button pattern the old OnboardingModal already used for its asset list --
 * is reused as-is (see the local, non-exported OptionButton helper), not
 * reinvented as a new general-purpose component.
 */

const labelStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontSize: '12px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--neutral-600)',
}

const hintStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '13px',
  color: 'var(--neutral-600)',
  fontStyle: 'italic',
}

/** Local render helper -- not a new general-purpose component; reuses the
 *  existing role="radio" pattern the old OnboardingModal already used. */
function OptionButton({
  selected,
  label,
  sublabel,
  onClick,
}: {
  selected: boolean
  label: string
  sublabel?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      style={{
        textAlign: 'left',
        border: selected ? '2px solid var(--indigo-600)' : '1.5px solid var(--border-default)',
        borderRadius: '10px',
        padding: '10px 14px',
        background: selected ? 'var(--indigo-050)' : 'var(--white)',
        cursor: 'pointer',
        transition: 'border-color 150ms ease, background 150ms ease',
        fontFamily: 'inherit',
      }}
    >
      <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--neutral-900)' }}>{label}</p>
      {sublabel && (
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--neutral-600)', fontStyle: 'italic' }}>{sublabel}</p>
      )}
    </button>
  )
}

export default function OnboardingModal() {
  const {
    landscapeConfiguration,
    setLandscapeConfiguration,
    showOnboarding,
    closeOnboarding,
    completeOnboarding,
    startTour,
  } = useApp()
  const navigate = useNavigate()

  const [config, setConfig] = useState<LandscapeConfiguration>(landscapeConfiguration)

  const diseaseAreas = config.therapeuticAreaId ? getDiseaseAreasForTherapeuticArea(config.therapeuticAreaId) : []
  const homeAssets = config.diseaseAreaId ? getAssetsForDiseaseArea(config.diseaseAreaId) : []
  const submittable = isLandscapeConfigurationSubmittable(config)

  function handleSelectTherapeuticArea(id: string) {
    setConfig((prev) => applyTherapeuticAreaSelection(prev, id))
  }
  function handleSelectDiseaseArea(id: string) {
    setConfig((prev) => applyDiseaseAreaSelection(prev, id))
  }
  function handleSelectHomeAsset(id: string) {
    setConfig((prev) => applyHomeAssetSelection(prev, id))
  }

  // Primary persistence path (product contract Step 10): one call to
  // setLandscapeConfiguration, which itself keeps the legacy userAssetId/
  // userAssetName/userIndication fields in sync -- not three separate legacy
  // setters called from here. Never touches watchedCompetitors: no
  // suggestedCompetitors fallback, no candidate-status auto-add. See this
  // step's checkpoint for the known cross-landscape watchlist gap this
  // deliberately leaves unresolved (Frontend Steps 4-6's job).
  function persist() {
    if (!submittable) return
    setLandscapeConfiguration(config)
    completeOnboarding([])
  }

  function handleEnterWorkspace() {
    if (!submittable) return
    persist()
    closeOnboarding()
    navigate('/')
  }

  function handleStartTour() {
    if (!submittable) return
    persist()
    startTour()
  }

  return (
    <Dialog
      open={showOnboarding}
      onOpenChange={(open) => {
        if (!open) closeOnboarding()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle style={{ fontSize: '20px' }}>Define your landscape</DialogTitle>
          <DialogDescription>
            Tell Ariya what you're tracking — we'll configure your signals feed and relevance filter around it.
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '4px 0' }}>
          {/* ── Therapeutic Area ── */}
          <div>
            <p style={labelStyle}>Therapeutic Area</p>
            <div role="radiogroup" aria-label="Therapeutic Area" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {THERAPEUTIC_AREAS.map((ta) => (
                <OptionButton
                  key={ta.id}
                  selected={config.therapeuticAreaId === ta.id}
                  label={ta.name}
                  onClick={() => handleSelectTherapeuticArea(ta.id)}
                />
              ))}
            </div>
          </div>

          {/* ── Disease Area ── */}
          <div>
            <p style={labelStyle}>Disease Area</p>
            {!config.therapeuticAreaId ? (
              <p style={hintStyle}>Select a Therapeutic Area first.</p>
            ) : (
              <div role="radiogroup" aria-label="Disease Area" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {diseaseAreas.map((da) => (
                  <OptionButton
                    key={da.id}
                    selected={config.diseaseAreaId === da.id}
                    label={da.name}
                    onClick={() => handleSelectDiseaseArea(da.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Home / Reference Asset ── */}
          <div>
            <p style={labelStyle}>Home / Reference Asset</p>
            {!config.diseaseAreaId ? (
              <p style={hintStyle}>Select a Disease Area first.</p>
            ) : homeAssets.length === 0 ? (
              <EmptyState message="No configured home assets are available for this disease area yet." />
            ) : (
              <div role="radiogroup" aria-label="Home Asset" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {homeAssets.map((asset) => (
                  <OptionButton
                    key={asset.id}
                    selected={config.homeAssetId === asset.id}
                    label={asset.brandName}
                    sublabel={asset.innName}
                    onClick={() => handleSelectHomeAsset(asset.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleStartTour} disabled={!submittable}>
            Start tour
          </Button>
          <Button onClick={handleEnterWorkspace} disabled={!submittable}>
            Enter workspace
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
