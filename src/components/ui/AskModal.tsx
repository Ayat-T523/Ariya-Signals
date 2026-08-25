import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { SkeletonAskResponse } from './Skeleton'
import { DEMO } from '../../config/demo-config'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../shadcn/ui/dialog'
import { Button } from '../shadcn/ui/button'
import { Sparkles } from '../animate-ui/icons/sparkles'
import { useApp, useConfig } from '../../context/AppContext'
import { competitorsData } from '../../data/kalvista'
import { getRecentSignals } from '../../lib/db'
import { askOllama, OllamaError } from '../../lib/ollama'

function competitorName(id: string) {
  return competitorsData.find((c) => c.id === id)?.name ?? id
}

// Two modes: a specific typed/clicked question (answer it directly, signals
// are supporting context, general pharma knowledge is fair game) vs. no
// question at all -- e.g. War Room's header button -- which falls back to a
// grounded-only recent-activity briefing (never invent facts there, since
// there's no explicit question to answer beyond "what's new").
function buildSystemPrompt(assetName: string, indication: string, hasQuestion: boolean) {
  if (hasQuestion) {
    return [
      `You are the analyst voice inside Ariya Signals, a competitive-intelligence platform for a pharma team tracking ${assetName} in ${indication}.`,
      "Answer the user's question directly and concisely (3-6 sentences, plain prose, no headers or bullet points).",
      'Recent competitor signals are provided as supporting context -- use them when relevant, and say so when you do. For anything the signals don\'t cover, you may draw on your own general pharmaceutical and clinical knowledge, but don\'t claim general knowledge is a specific tracked signal.',
      'Do not open with a disclaimer or restate the question -- answer it.',
    ].join(' ')
  }
  return [
    `You are the analyst voice inside Ariya Signals, a competitive-intelligence platform for a pharma team tracking ${assetName} in ${indication}.`,
    'Write a short briefing (2-4 sentences, plain prose, no headers or bullet points) summarizing the most notable recent competitor activity from the signals given.',
    'Only use facts explicitly present in the signals below. Never invent a company name, date, or event that isn\'t there.',
    'If there are no signals, say plainly that there is nothing new to report right now -- do not pad the response.',
  ].join(' ')
}

function buildUserPrompt(
  signals: Array<{ competitor: string; headline: string; date: string | null; whyItMatters: string | null }>,
  question: string | null,
) {
  const signalsBlock = signals.length > 0
    ? ['Recent competitor signals (most recent first):', ...signals.map((s) => `- [${s.date ?? 'undated'}] ${s.competitor}: ${s.headline}${s.whyItMatters ? ` -- why it matters: ${s.whyItMatters}` : ''}`)].join('\n')
    : 'No recent signals are available for the tracked competitors.'
  if (!question) return signalsBlock
  return `${signalsBlock}\n\nQuestion: ${question}`
}

type Status = 'loading' | 'done' | 'error'

export default function AskModal({ open, onOpenChange, question }: { open: boolean; onOpenChange: (open: boolean) => void; source?: string | null; question?: string | null }) {
  const { watchedCompetitors } = useApp()
  const { assetName, indication } = useConfig()
  const [status, setStatus] = useState<Status>('loading')
  const [responseText, setResponseText] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setStatus('loading')

    async function run() {
      try {
        const competitorIds = watchedCompetitors.size > 0 ? [...watchedCompetitors] : undefined
        const signals = await getRecentSignals(14, competitorIds)
        const readable = signals
          .filter((s) => s.clean_headline || s.headline)
          .slice(0, 12)
          .map((s) => ({
            competitor: competitorName(s.competitor_id),
            headline: s.clean_headline ?? s.headline ?? '',
            date: s.date,
            whyItMatters: s.why_it_matters,
          }))
        const text = await askOllama(
          buildSystemPrompt(assetName, indication, Boolean(question)),
          buildUserPrompt(readable, question ?? null),
        )
        if (!cancelled) { setResponseText(text); setStatus('done') }
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof OllamaError ? err.message : 'Something went wrong generating this analysis.')
          setStatus('error')
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [open, watchedCompetitors, assetName, indication, question])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[520px]"
        style={{ padding: '32px', borderRadius: 'var(--r-flat-content)', fontFamily: 'var(--font-ui)' }}
      >
        <DialogHeader>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '4px' }}>
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '32px', height: '32px', flexShrink: 0,
                background: 'var(--indigo-050)', borderRadius: 'var(--r-flat-control)',
              }}
            >
              <Sparkles size={15} color="var(--indigo-600)" animate={status === 'loading' ? 'path-loop' : 'path'} loop={status === 'loading'} />
            </div>
            <DialogTitle style={{ fontSize: '15px', fontWeight: 600, color: 'var(--neutral-900)', lineHeight: 1.4 }}>
              {question ?? "Ariya's analysis"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {status === 'loading' ? (
          <div style={{ margin: '0 0 20px' }}>
            <SkeletonAskResponse />
          </div>
        ) : status === 'error' ? (
          <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.65, color: 'var(--crimson-600)' }}>
            {errorMessage}
          </p>
        ) : (
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.65, color: 'var(--neutral-700)' }}
          >
            {responseText}
          </motion.p>
        )}

        <p style={{ margin: '0 0 16px', fontSize: '11px', color: 'var(--neutral-500)' }}>
          Generated locally by {DEMO.appName}'s AI, grounded in your tracked {assetName} competitor signals.
        </p>

        <Button type="button" onClick={() => onOpenChange(false)} style={{ width: '100%' }}>
          Done
        </Button>
      </DialogContent>
    </Dialog>
  )
}
