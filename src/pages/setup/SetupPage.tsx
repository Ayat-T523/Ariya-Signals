import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import {
  type SetupDraft,
  type SetupStage,
  createEmptySetupDraft,
  loadSetupDraft,
  saveSetupDraft,
  clearSetupDraft,
  hasDownstreamData,
  clearDownstreamData,
  draftToTrackedCompetitors,
  clearCompanySelections,
} from '../../config/setup-draft'
import { Progress } from '../../components/shadcn/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../components/shadcn/ui/dialog'
import { Button } from '../../components/shadcn/ui/button'
import Stage1Define from './Stage1Define'
import Stage2Discover from './Stage2Discover'
import Stage3Configure from './Stage3Configure'

const STAGES: { id: SetupStage; label: string }[] = [
  { id: 'define', label: 'Define landscape' },
  { id: 'discover', label: 'Find competitors' },
  { id: 'configure', label: 'Configure landscape' },
]

const STAGE_INDEX: Record<SetupStage, number> = { define: 0, discover: 1, configure: 2 }

/**
 * SetupPage.tsx — dedicated full-page staged landscape setup, replacing the
 * old modal onboarding. Internal stage state (define/discover/configure) on
 * one route, not three separate browser routes -- this is sequential
 * configuration, users may go back to a completed stage but never jump
 * forward into an invalid one (see canAdvanceTo below).
 *
 * Resume/reopen (NAV 3/4): a persisted draft (localStorage) resumes exactly
 * where it left off. With no persisted draft but an already-completed
 * landscapeConfiguration/trackedCompetitors in AppContext, the draft is
 * seeded from that existing configuration instead of starting blank --
 * this is the "reopen to edit" entry point (NavPanel's Compass icon,
 * AdminPage's "Edit landscape").
 */
export default function SetupPage() {
  const {
    landscapeConfiguration, trackedCompetitors, completeSetup, setLandscapeConfiguration, startTour,
    hydrateNewLandscape,
  } = useApp()
  const navigate = useNavigate()
  // NEW LANDSCAPE SIGNAL BOOTSTRAP (2026-08-24): true only while awaiting
  // hydrateNewLandscape() below, between clicking Enter Ariya/Start tour and
  // actually navigating into the workspace -- see that function's own
  // docstring for why this specific call site must await hydration instead
  // of firing it in the background the way ensureHydration() does.
  const [isEnteringWorkspace, setIsEnteringWorkspace] = useState(false)

  const [draft, setDraft] = useState<SetupDraft>(() => {
    const persisted = loadSetupDraft()
    if (persisted) return persisted

    // A tracked competitor persisted before this milestone's company-rooted
    // rewrite carries the OLD shape (no companyId/relevantAssets/evidenceRefs)
    // -- filtered out here rather than trusted, so a pre-migration
    // localStorage entry degrades to "not seeded" instead of crashing Stage 3
    // on `.relevantAssets.length` of undefined.
    const validTrackedCompetitors = trackedCompetitors.filter(
      (c): c is typeof c & { companyId: string; companyName: string } =>
        typeof c.companyId === 'string' && typeof c.companyName === 'string',
    )

    if (validTrackedCompetitors.length > 0) {
      // Re-editing an already-completed setup: seed Stage 1 + Stage 3 from
      // what's already configured, never guessing anything not already there.
      const seeded = createEmptySetupDraft(landscapeConfiguration)
      seeded.stage = 'configure'
      seeded.companies = validTrackedCompetitors.map((c) => ({
        id: c.companyId,
        source: c.source,
        companyName: c.companyName,
        relevantAssets: c.relevantAssets ?? [],
        ariyaAssessment: c.ariyaAssessment,
        evidenceStatus: c.evidenceStatus,
        evidenceRefs: c.evidenceRefs ?? [],
        verifiedDomains: [],
        whySuggested: null,
      }))
      seeded.selections = validTrackedCompetitors.map((c) => ({ companyId: c.companyId, userRelationship: c.userRelationship }))
      return seeded
    }

    return createEmptySetupDraft(landscapeConfiguration)
  })

  const [pendingChange, setPendingChange] = useState<SetupDraft | null>(null)

  // NAV 3 — persist safe draft state on every change (never loading state, never authoritative candidate cache beyond what's already in `candidates`).
  useEffect(() => { saveSetupDraft(draft) }, [draft])

  function applyDraft(next: SetupDraft) {
    setDraft(next)
  }

  // NAV 2 — a Stage 1 change that would strand Stage 2/3 data requires explicit confirmation.
  function handleStage1Change(next: SetupDraft) {
    const landscapeChanged =
      next.landscapeConfiguration.therapeuticAreaId !== draft.landscapeConfiguration.therapeuticAreaId ||
      next.landscapeConfiguration.diseaseAreaId !== draft.landscapeConfiguration.diseaseAreaId ||
      next.landscapeConfiguration.homeAssetId !== draft.landscapeConfiguration.homeAssetId

    if (landscapeChanged && hasDownstreamData(draft)) {
      setPendingChange(next)
      return
    }
    applyDraft(next)
  }

  function confirmLandscapeChange() {
    if (!pendingChange) return
    applyDraft(clearDownstreamData(pendingChange))
    setPendingChange(null)
  }

  function goToStage(stage: SetupStage) {
    setDraft((prev) => ({ ...prev, stage }))
  }

  // NEW LANDSCAPE SIGNAL BOOTSTRAP (2026-08-24): both handlers now await
  // hydrateNewLandscape() -- using the draft's OWN freshly-completed values,
  // never context state (setLandscapeConfiguration/completeSetup's own
  // setState calls have not been reflected back into this render's
  // landscapeConfiguration/manualHomeAsset/etc. yet) -- before doing
  // anything the workspace's own first render depends on. This closes the
  // proven race: without it, War Room/Intelligence Feed's own Signal fetch
  // could run before this SAME hydration call (discovery + evidence
  // enrichment + Signal derivation) had finished.
  async function handleEnterAriya() {
    setIsEnteringWorkspace(true)
    setLandscapeConfiguration(draft.landscapeConfiguration)
    const competitors = draftToTrackedCompetitors(draft)
    completeSetup(competitors, draft.manualAsset, draft.resolvedAsset, draft.manualDiseaseArea, draft.resolvedDiseaseArea)
    await hydrateNewLandscape(
      draft.landscapeConfiguration.homeAssetId, draft.landscapeConfiguration.diseaseAreaId,
      draft.manualAsset, draft.resolvedAsset, draft.manualDiseaseArea, draft.resolvedDiseaseArea,
      // FDA V1 scope hardening (multi-source recon unit 2 follow-up): the
      // freshly-completed draft's OWN selected competitors, same "use the
      // draft's values, never context state" discipline as every other
      // argument here -- this is the exact Stage-3-selection state the
      // backend enrichment scope needs, and until this fix it never
      // reached hydrateNewLandscape() at all.
      competitors.filter((c) => c.source === 'discovered').map((c) => c.companyId),
    )
    clearSetupDraft()
    navigate('/')
  }

  async function handleStartTour() {
    setIsEnteringWorkspace(true)
    setLandscapeConfiguration(draft.landscapeConfiguration)
    const competitors = draftToTrackedCompetitors(draft)
    completeSetup(competitors, draft.manualAsset, draft.resolvedAsset, draft.manualDiseaseArea, draft.resolvedDiseaseArea)
    await hydrateNewLandscape(
      draft.landscapeConfiguration.homeAssetId, draft.landscapeConfiguration.diseaseAreaId,
      draft.manualAsset, draft.resolvedAsset, draft.manualDiseaseArea, draft.resolvedDiseaseArea,
      competitors.filter((c) => c.source === 'discovered').map((c) => c.companyId),
    )
    clearSetupDraft()
    startTour()
  }

  const stageIndex = STAGE_INDEX[draft.stage]
  const progressValue = ((stageIndex + 1) / STAGES.length) * 100
  const wideStage = draft.stage !== 'define'

  return (
    <div className="min-h-dvh bg-background">
      <div className={`mx-auto flex flex-col gap-6 px-4 py-8 sm:px-6 ${wideStage ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Ariya Signals</p>
          <h1 className="mt-1 text-xl font-semibold">Set up your competitive landscape</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tell Ariya what market you want to understand.</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
            {STAGES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                disabled={i > stageIndex}
                onClick={() => { if (i <= stageIndex) goToStage(s.id) }}
                className={`font-medium ${i === stageIndex ? 'text-foreground' : i < stageIndex ? 'text-muted-foreground underline decoration-dashed underline-offset-4' : 'cursor-not-allowed text-muted-foreground/50'}`}
              >
                {i + 1}&nbsp; {s.label}
              </button>
            ))}
          </div>
          <Progress value={progressValue} />
        </div>

        <div className="rounded-xl border bg-card p-5 sm:p-6">
          {draft.stage === 'define' && (
            <Stage1Define draft={draft} onChange={handleStage1Change} onContinue={() => goToStage('discover')} />
          )}
          {draft.stage === 'discover' && (
            <Stage2Discover
              draft={draft}
              onChange={applyDraft}
              onBack={() => goToStage('define')}
            />
          )}
          {draft.stage === 'configure' && (
            <Stage3Configure
              draft={draft}
              onChange={applyDraft}
              onBack={() => goToStage('discover')}
              onEnterAriya={handleEnterAriya}
              onStartTour={handleStartTour}
              submitting={isEnteringWorkspace}
            />
          )}
        </div>
      </div>

      {/* Root-Cause Recon implementation, Part D — persistent Stage 2
          selection footer. `fixed`, not `sticky`: SetupPage renders outside
          the app's own sidebar-08 shell and scrolls at the document level
          (no inner overflow-y-auto ancestor exists for `sticky` to bind
          to), and there is no other persistent header/footer chrome here
          to coordinate with -- see this milestone's own recon report,
          Section O, for the live-DOM investigation behind this choice. */}
      {draft.stage === 'discover' && (
        <div className="fixed inset-x-0 bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm font-medium">
              {draft.selections.length} {draft.selections.length === 1 ? 'company' : 'companies'} selected
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost" size="sm"
                className="hidden sm:inline-flex"
                disabled={draft.selections.length === 0}
                onClick={() => applyDraft(clearCompanySelections(draft))}
              >
                Clear selection
              </Button>
              <Button size="sm" disabled={draft.selections.length === 0} onClick={() => goToStage('configure')}>
                Continue →
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* NAV 2 — stale landscape confirmation */}
      <Dialog open={!!pendingChange} onOpenChange={(open) => { if (!open) setPendingChange(null) }}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-md">
          <DialogHeader className="shrink-0">
            <DialogTitle>Change landscape?</DialogTitle>
            <DialogDescription>
              Changing the home landscape will clear the current competitor discovery and selection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="shrink-0">
            <Button variant="outline" onClick={() => setPendingChange(null)}>Cancel</Button>
            <Button onClick={confirmLandscapeChange}>Change landscape</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
