import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../shadcn/ui/dialog'
import { Button } from '../shadcn/ui/button'
import { Separator } from '../shadcn/ui/separator'
import { useConfig } from '../../context/AppContext'
import { DEMO, APP_VERSION } from '../../config/demo-config'

/**
 * HelpModal.tsx — moved out of the retired NavPanel.tsx (sidebar-08
 * migration) unchanged in content/behavior. Section descriptions and
 * DEMO.companyLabel/appName are legitimate static app copy, not per-user
 * fixture data -- distinct from the "David"/"Pharma Inc" account-identity
 * fixture this migration removes from the shell.
 *
 * Viewport-safe: explicit maxHeight + overflowY, per this repo's overlay
 * rule (see Frontend Step 4's checkpoint for the origin of that rule).
 */
function buildHelpSections(assetName: string, indication: string) {
  return [
    { name: 'War Room',          description: 'Your personalised landing page: the highest-priority signals and recent alerts in one view.' },
    { name: 'Intelligence Feed', description: 'Events calendar, earnings digests, deal landscape, and HTA tracker — all in one feed.' },
    { name: 'Competitors',       description: 'Pipeline, company, and messaging profiles for all tracked competitors with timeline view.' },
    { name: 'Market Performance',description: `${assetName} uptake vs the ${indication} class across DE, UK, US, and other key markets.` },
    { name: 'Pricing and Access',description: 'Multi-region pricing benchmark and reimbursement status across tracked markets.' },
    { name: 'Alerts',            description: 'Full signal feed, filterable by type and competitor. Mark alerts read and archive.' },
    { name: 'My Space',          description: 'Configure your delivery preferences, personal saved alerts, and uploaded documents.' },
  ]
}

export default function HelpModal({
  open,
  onOpenChange,
  onTakeTour,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTakeTour: () => void
}) {
  const { assetName, indication } = useConfig()
  const helpSections = buildHelpSections(assetName, indication)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-[600px]"
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>What is Ariya Signals?</DialogTitle>
          <DialogDescription>
            A competitive intelligence hub for {DEMO.companyLabel}'s {indication} franchise. It monitors the competitive
            environment, tracks competitor pipeline and commercial moves, and delivers role-tailored
            insights so you spend less time gathering and more time deciding.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Sections</p>
          <div className="flex flex-col gap-3">
            {helpSections.map((s) => (
              <div key={s.name}>
                <p className="m-0 text-sm font-bold">{s.name}</p>
                <p className="m-0 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>

        <Separator className="shrink-0" />

        <div className="flex shrink-0 items-center justify-between gap-3.5">
          <p className="m-0 text-sm text-muted-foreground leading-relaxed">
            New here, or want a quick refresher? Take the guided tour.
          </p>
          <Button onClick={onTakeTour} size="sm" className="shrink-0">
            Take the tour
          </Button>
        </div>
        <p className="m-0 shrink-0 text-center text-xs text-muted-foreground tracking-wide">
          {DEMO.appName} demo · {APP_VERSION}
        </p>
      </DialogContent>
    </Dialog>
  )
}
