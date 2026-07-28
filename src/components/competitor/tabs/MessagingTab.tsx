import {
  Megaphone, TrendingUp, Globe, Mic, DollarSign, FileText, AlertTriangle, ExternalLink,
} from 'lucide-react'
import EmptyState from '../../ui/EmptyState'
import ProvenanceChip from '../../ui/ProvenanceChip'
import { useConfig } from '../../../context/AppContext'
import { formatDateAbs } from '../../../utils/formatDate'

// ── Source type config ────────────────────────────────────────────────────────
const SOURCE_TYPE_CONFIG = {
  'Congress presentation': { icon: Mic,         bg: 'rgba(0,85,187,0.09)',    text: '#0055BB' },
  'Press release':         { icon: Megaphone,   bg: 'rgba(5,10,68,0.07)',     text: 'rgba(5,10,68,0.55)' },
  'Investor call':         { icon: DollarSign,  bg: 'rgba(139,92,246,0.10)',  text: '#5B21B6' },
  'Website copy':          { icon: Globe,       bg: 'rgba(5,10,68,0.07)',     text: 'rgba(5,10,68,0.55)' },
  'Publication':           { icon: FileText,    bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
}

function getSourceCfg(sourceType) {
  return SOURCE_TYPE_CONFIG[sourceType] || { icon: FileText, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
}

// ── Shared section header ─────────────────────────────────────────────────────
function SectionHeader({ label }) {
  return (
    <p style={{
      margin: '0 0 12px', fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      color: 'rgba(5,10,68,0.40)',
    }}>
      {label}
    </p>
  )
}

// ── Current core message card ─────────────────────────────────────────────────
function CurrentMessageCard({ data }) {
  return (
    <div style={{
      background: 'rgba(42,118,244,0.15)',
      borderRadius: '16px',
      border: '1px solid rgba(210,226,255,1)',
      padding: '20px 24px',
    }}>
      {/* Label */}
      <p style={{
        margin: '0 0 8px', fontSize: '13px', fontWeight: 600,
        color: '#434c5b', fontFamily: 'Satoshi, sans-serif',
      }}>
        Current core message
      </p>

      {/* The message */}
      <p style={{
        margin: '0 0 14px', fontSize: '15px', fontWeight: 600,
        color: '#434c5b', lineHeight: '1.45',
      }}>
        &ldquo;{data.currentCoreMessage}&rdquo;
      </p>

      {/* Pillars */}
      {data.messagePillars?.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
          {data.messagePillars.map((pillar, i) => (
            <span key={i} style={{
              padding: '4px 12px', borderRadius: '8px',
              fontSize: '12px', fontWeight: 600,
              background: i === 0 ? '#050A44' : i === 1 ? 'rgba(0,85,187,0.10)' : 'rgba(5,10,68,0.07)',
              color: i === 0 ? '#FFFFFF' : i === 1 ? '#0055BB' : 'rgba(5,10,68,0.60)',
            }}>
              {pillar}
            </span>
          ))}
        </div>
      )}

      {/* Source */}
      {data.currentMessageSource && (
        <p style={{
          margin: 0, fontSize: '12px', color: '#708090',
          textAlign: 'right',
        }}>
          Source: {data.currentMessageSource}
        </p>
      )}
    </div>
  )
}

// ── Timeline entry card ───────────────────────────────────────────────────────
function TimelineCard({ entry }) {
  const srcCfg = getSourceCfg(entry.sourceType)
  const Icon = srcCfg.icon

  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(210,226,255,1)',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
    }}>
      {/* Top row: date + source chip + shift badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{
          fontSize: '12px', fontWeight: 700, color: 'rgba(5,10,68,0.55)',
          whiteSpace: 'nowrap',
        }}>
          {entry.date}
        </span>

        {/* Source type chip */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 9px', borderRadius: '9999px',
          fontSize: '11px', fontWeight: 700,
          background: srcCfg.bg, color: srcCfg.text,
        }}>
          <Icon size={10} />
          {entry.sourceType}
        </span>

        {/* Shift badge */}
        <span style={{
          marginLeft: 'auto',
          padding: '2px 9px', borderRadius: '9999px',
          fontSize: '11px', fontWeight: 700,
          background: entry.shiftDetected ? 'rgba(245,158,11,0.12)' : 'rgba(5,10,68,0.06)',
          color: entry.shiftDetected ? '#92500A' : 'rgba(5,10,68,0.40)',
          whiteSpace: 'nowrap',
        }}>
          {entry.shiftDetected ? '⚡ Shift detected' : 'Consistent with prior messaging'}
        </span>
      </div>

      {/* Headline */}
      <p style={{
        margin: 0, fontSize: '14px', fontWeight: 700,
        color: 'rgba(5,10,68,0.88)', lineHeight: '1.4',
      }}>
        {entry.headline}
      </p>

      {/* Detail */}
      <p style={{
        margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.65)',
        lineHeight: '1.60',
      }}>
        {entry.detail}
      </p>

      {/* Why it matters */}
      {entry.whyItMatters && (
        <div style={{ background: 'rgba(42,118,244,0.15)', borderRadius: '8px', padding: '10px 12px' }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
            <strong style={{
              color: '#434c5b', fontWeight: 600,
              fontSize: '13px', fontFamily: 'Satoshi, sans-serif',
            }}>
              Why it matters —{' '}
            </strong>
            {entry.whyItMatters}
          </p>
        </div>
      )}
    </div>
  )
}

// ── vs client comparison table ───────────────────────────────────────────────────
function ComparisonTable({ rows, competitorName, competitorId }) {
  // "Our side" is the user's tracked asset, not a hardcoded company. This column
  // used to read DEMO.companyLabel, so it said "Pharma Inc" to every user.
  const { assetName } = useConfig()
  return (
    <div style={{
      background: '#FFFFFF',
      borderRadius: '16px',
      border: '1px solid rgba(210,226,255,1)',
      overflow: 'hidden',
    }}>
      {/* Column headers */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        background: 'rgba(5,10,68,0.03)',
        borderBottom: '1px solid rgba(5,10,68,0.08)',
      }}>
        <div style={{ padding: '12px 16px', borderRight: '1px solid rgba(5,10,68,0.08)' }}>
          <p style={{
            margin: 0, fontSize: '13px', fontWeight: 600,
            color: '#434c5b',
          }}>
            {competitorName}'s message
          </p>
        </div>
        <div style={{ padding: '12px 16px' }}>
          <p style={{
            margin: 0, fontSize: '13px', fontWeight: 600,
            color: '#434c5b',
          }}>
            {assetName}'s position
          </p>
        </div>
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            borderBottom: i < rows.length - 1 ? '1px solid rgba(5,10,68,0.06)' : 'none',
          }}
        >
          {/* Competitor claim */}
          <div style={{
            padding: '14px 16px',
            borderRight: '1px solid rgba(5,10,68,0.06)',
            background: i % 2 === 0 ? 'transparent' : 'rgba(5,10,68,0.01)',
          }}>
            <p style={{
              margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.70)',
              lineHeight: '1.55', fontStyle: 'italic',
            }}>
              &ldquo;{row.competitorClaim}&rdquo;
            </p>
          </div>

          {/* Client position */}
          <div style={{
            padding: '14px 16px',
            background: i % 2 === 0 ? 'rgba(0,85,187,0.02)' : 'rgba(0,85,187,0.03)',
          }}>
            <p style={{
              margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.75)',
              lineHeight: '1.55',
            }}>
              {row.pharmaIncPosition}
            </p>
          </div>
        </div>
      ))}

      {/* The "Ask Ariya to analyze this" CTA that closed this card is removed:
          AI generation is excluded (handoff index §2, frontend §2). */}
    </div>
  )
}

// ── Document type display config ──────────────────────────────────────────────
const DOC_TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  '10-K':      { label: '10-K',       bg: 'rgba(0,85,187,0.09)',   text: '#0055BB' },
  '20-F':      { label: '20-F',       bg: 'rgba(0,85,187,0.09)',   text: '#0055BB' },
  'FDA-label': { label: 'FDA Label',  bg: 'rgba(16,185,129,0.10)', text: '#065F46' },
  'NICE-TA':   { label: 'NICE TA',    bg: 'rgba(139,92,246,0.10)', text: '#5B21B6' },
  'EMA-EPAR':  { label: 'EMA EPAR',   bg: 'rgba(139,92,246,0.10)', text: '#5B21B6' },
}

function docTypeCfg(type: string) {
  return DOC_TYPE_CONFIG[type] ?? { label: type, bg: 'rgba(5,10,68,0.07)', text: 'rgba(5,10,68,0.55)' }
}

// ── Source documents section ──────────────────────────────────────────────────
function SourceDocsSection({ docs }: { docs: any[] }) {
  // Only show regulatory / annual report document types — 8-K signals are in Announcements
  const relevant = docs.filter((d: any) =>
    ['10-K', '20-F', 'FDA-label', 'NICE-TA', 'EMA-EPAR'].includes(d.document_type)
  )
  if (!relevant.length) return null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.40)' }}>
          Ingested Source Documents
        </p>
        <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '9999px', background: 'rgba(22,163,74,0.10)', color: '#15803d' }}>
          Live · Primary sources
        </span>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic' }}>
        These documents have been downloaded and indexed. Messaging analysis will be extracted from them by an analyst — review pending.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {relevant.map((doc: any) => {
          const cfg = docTypeCfg(doc.document_type)
          const wordLabel = doc.word_count ? `${Math.round(doc.word_count / 1000)}k words` : null
          return (
            <div key={doc.id} style={{
              background: '#FFFFFF', borderRadius: '10px',
              border: '1px solid rgba(210,226,255,1)',
              padding: '10px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                <span style={{
                  flexShrink: 0, padding: '2px 9px', borderRadius: '9999px',
                  fontSize: '11px', fontWeight: 700,
                  background: cfg.bg, color: cfg.text,
                }}>
                  {cfg.label}
                </span>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.80)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.source_label ?? doc.document_type}
                </p>
                {doc.date_published && (
                  <span style={{ flexShrink: 0, fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>
                    {formatDateAbs(doc.date_published)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                {wordLabel && (
                  <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.35)', whiteSpace: 'nowrap' }}>
                    {wordLabel}
                  </span>
                )}
                <a href={doc.source_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', color: 'rgba(5,10,68,0.35)' }}>
                  <ExternalLink size={12} />
                </a>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Recent company announcements (from SEC 8-K press releases) ───────────────
function AnnouncementsSection({ items }: { items: any[] }) {
  if (!items?.length) return null
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <p style={{ margin: 0, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.40)' }}>
          Recent Company Announcements
        </p>
      </div>
      <p style={{ margin: '0 0 10px', fontSize: '12px', color: 'rgba(5,10,68,0.45)', fontStyle: 'italic' }}>
        Direct company press releases (8-K item 8.01) — interpret for messaging relevance.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {items.map((item, i) => (
          <div key={i} style={{ background: '#FFFFFF', borderRadius: '10px', border: '1px solid rgba(210,226,255,1)', padding: '12px 14px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.80)', lineHeight: '1.4', flex: 1 }}>{item.headline}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {item.accession_number
                ? <ProvenanceChip
                    sourceLabel={item.sourceLabel ?? 'SEC EDGAR'}
                    sourceUrl={item.sourceUrl}
                    date={item.date}
                    tier={item.tier}
                    lastRefreshed={item.lastRefreshed}
                  />
                : item.date && <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)', whiteSpace: 'nowrap' }}>{formatDateAbs(item.date)}</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function MessagingTab({ competitor }) {
  const { assetName } = useConfig()
  const data        = competitor.messaging
  const pressItems  = competitor.recentPressReleases ?? []
  const sourceDocs  = competitor.sourceDocs ?? []

  if (!data && !pressItems.length && !sourceDocs.length) {
    return (
      <EmptyState message="No messaging data tracked yet. Add sources to begin monitoring this competitor's positioning." />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Live announcements — shown first as raw signals */}
      <AnnouncementsSection items={pressItems} />

      {/* Ingested primary source documents */}
      <SourceDocsSection docs={sourceDocs} />

      {/* Structured messaging analysis — live when snapshot exists, stub otherwise */}
      {data ? (
        <>
          {/* Current core message */}
          <div>
            <SectionHeader label="Current positioning" />
            <CurrentMessageCard data={data} />
          </div>

          {/* Messaging history timeline */}
          {data.timeline?.length > 0 && (
            <div>
              <SectionHeader label="Messaging history" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {data.timeline.map((entry, i) => (
                  <TimelineCard key={i} entry={entry} />
                ))}
              </div>
            </div>
          )}

          {/* Comparison against the user's own tracked asset. The data key is
              historical; the label follows the account, not the key. */}
          {data.vsPharmaInc?.length > 0 && (
            <div>
              <SectionHeader label={`vs ${assetName}`} />
              <ComparisonTable
                rows={data.vsPharmaInc}
                competitorName={competitor.name}
                competitorId={competitor.id}
              />
            </div>
          )}
        </>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '14px 16px', borderRadius: '10px',
          background: 'rgba(5,10,68,0.03)', border: '1px solid rgba(210,226,255,1)',
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, color: 'rgba(5,10,68,0.35)', marginTop: '2px' }} />
          <div>
            <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.80)' }}>
              Messaging data not yet available
            </p>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.55' }}>
              Structured messaging analysis requires systematic review of congress presentations, earnings transcripts, and press releases.
              {sourceDocs.length > 0
                ? ' Ingested source documents are listed below — review pending.'
                : ' No source documents have been ingested for this competitor yet.'}
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
