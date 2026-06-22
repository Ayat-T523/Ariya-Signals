import { useState, useEffect } from 'react'
import { BookOpen, Mic, MessageSquare, Users, X, Sparkles } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import kolsData from '../../data/kols.json'
import kolActivityData from '../../data/kol-activity.json'
import kolAppearancesData from '../../data/kol-appearances.json'
import competitorsData from '../../data/competitors.json'

// ── Competitor color system for affiliation badges ────────────────────────────
const COMPETITOR_COLORS = {
  takeda:    { bg: 'rgba(5,10,68,0.08)',   text: 'rgba(5,10,68,0.70)' },
  biocryst:  { bg: 'rgba(0,85,187,0.10)',  text: '#0055BB'             },
  pharvaris: { bg: 'rgba(225,29,72,0.10)', text: '#C01041'             },
}

function competitorName(id) {
  return competitorsData.find((c) => c.id === id)?.name ?? id
}

// ── Affiliation badge ─────────────────────────────────────────────────────────
function AffBadge({ id }) {
  const cfg = COMPETITOR_COLORS[id] ?? { bg: 'rgba(5,10,68,0.06)', text: 'rgba(5,10,68,0.45)' }
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700, padding: '2px 8px',
      borderRadius: '9999px', background: cfg.bg, color: cfg.text,
      whiteSpace: 'nowrap',
    }}>
      {competitorName(id)}
    </span>
  )
}

// ── Influence dots: High = ●●●, Medium = ●●○, Low = ●○○ ─────────────────────
function InfluenceDots({ level }) {
  const filled = level === 'high' ? 3 : level === 'medium' ? 2 : 1
  return (
    <div>
      <div style={{ display: 'flex', gap: '3px', marginBottom: '3px' }}>
        {[1, 2, 3].map((i) => (
          <span
            key={i}
            style={{ fontSize: '11px', color: i <= filled ? '#050A44' : 'rgba(5,10,68,0.15)' }}
          >
            ●
          </span>
        ))}
      </div>
      <p style={{
        margin: 0, fontSize: '10px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
        color: 'rgba(5,10,68,0.35)',
      }}>
        HAE influence
      </p>
    </div>
  )
}

// ── Activity type config ──────────────────────────────────────────────────────
const ACTIVITY_CONFIG = {
  'Publication':              { Icon: BookOpen,      bg: 'rgba(0,85,187,0.09)',   text: '#0055BB'             },
  'Congress presentation':    { Icon: Mic,           bg: 'rgba(5,10,68,0.07)',    text: 'rgba(5,10,68,0.55)' },
  'Interview or commentary':  { Icon: MessageSquare, bg: 'rgba(245,158,11,0.10)', text: '#92500A'             },
  'Advisory board signal':    { Icon: Users,         bg: 'rgba(16,185,129,0.10)', text: '#065F46'             },
}

// ── KOL detail modal ──────────────────────────────────────────────────────────
function KOLModal({ kol, onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        zIndex: 50, background: 'rgba(5,10,68,0.40)', backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div style={{
        background: '#FFFFFF', borderRadius: '20px',
        maxWidth: '600px', width: 'calc(100% - 32px)',
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 40px rgba(5,10,68,0.18)',
      }}>

        {/* Sticky header */}
        <div style={{ padding: '24px 28px 0', flexShrink: 0, position: 'relative' }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              width: '28px', height: '28px', background: 'none', border: 'none',
              cursor: 'pointer', color: 'rgba(5,10,68,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', marginBottom: '20px' }}>
            {/* Avatar */}
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(5,10,68,0.10)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'rgba(5,10,68,0.50)' }}>
                {kol.initials}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
                {kol.name}
              </h2>
              <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.4' }}>
                {kol.institution}
              </p>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {kol.affiliations.length === 0
                  ? <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.45)' }}>Independent</span>
                  : kol.affiliations.map((id) => <AffBadge key={id} id={id} />)
                }
              </div>
            </div>
          </div>
          <div style={{ height: '1px', background: 'rgba(5,10,68,0.06)', marginLeft: '-28px', marginRight: '-28px' }} />
        </div>

        {/* Scrollable body */}
        <div style={{ padding: '20px 28px 28px', overflowY: 'auto', flex: 1 }}>

          {/* Bio */}
          <p style={{ margin: '0 0 20px', fontSize: '14px', color: 'rgba(5,10,68,0.70)', lineHeight: '1.65' }}>
            {kol.bio}
          </p>

          {/* Publication highlights */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
              Publication highlights
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {kol.publicationHighlights.map((pub, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(5,10,68,0.40)', flexShrink: 0, paddingTop: '2px' }}>
                    {pub.year}
                  </span>
                  <div>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#0055BB', marginRight: '6px' }}>{pub.journal}</span>
                    <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.70)' }}>
                      {pub.title.length > 80 ? pub.title.slice(0, 80) + '…' : pub.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Congress appearances */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
              Congress appearances
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {kol.congressAppearances.map((app, i) => (
                <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.40)', flexShrink: 0, paddingTop: '2px', whiteSpace: 'nowrap' }}>
                    {app.date}
                  </span>
                  <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.70)', lineHeight: '1.5' }}>
                    <strong style={{ color: 'rgba(5,10,68,0.75)', fontWeight: 600 }}>{app.congress}</strong>
                    {' — '}
                    {app.topic}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Disclosed relationships */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)' }}>
              Disclosed in publications
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {kol.disclosedRelationships.map((rel, i) => (
                <p key={i} style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.60)', lineHeight: '1.5' }}>
                  · {rel}
                </p>
              ))}
            </div>
          </div>

          {/* What it means for Pharma Inc */}
          <div style={{ background: '#E8EAF6', borderRadius: '10px', padding: '12px 16px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
              <strong style={{
                color: 'rgba(5,10,68,0.50)', fontWeight: 600,
                fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                What this means for Pharma Inc —{' '}
              </strong>
              {kol.whatItMeansForPharmaInc}
            </p>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── KOL card ──────────────────────────────────────────────────────────────────
function KOLCard({ kol, onOpen }) {
  return (
    <div
      onClick={() => onOpen(kol.id)}
      style={{
        background: '#FFFFFF', borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)', padding: '18px',
        cursor: 'pointer', transition: 'box-shadow 150ms ease',
        display: 'flex', flexDirection: 'column', gap: '10px',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(5,10,68,0.10)' }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '' }}
    >
      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(5,10,68,0.10)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(5,10,68,0.50)' }}>
            {kol.initials}
          </span>
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.90)' }}>
            {kol.name}
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(5,10,68,0.50)', lineHeight: '1.4' }}>
            {kol.institution}
          </p>
        </div>
      </div>

      {/* Affiliation badges */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {kol.affiliations.length === 0
          ? <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.45)' }}>Independent</span>
          : kol.affiliations.map((id) => <AffBadge key={id} id={id} />)
        }
      </div>

      {/* Influence + stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <InfluenceDots level={kol.influence} />
        <div style={{ textAlign: 'right' }}>
          <p style={{ margin: '0 0 2px', fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
            {kol.haePublicationCount} HAE publications
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(5,10,68,0.38)' }}>
            Last seen: {kol.lastActive}
          </p>
        </div>
      </div>

      {/* View activity button */}
      <div>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(kol.id) }}
          style={{
            fontSize: '12px', fontWeight: 600, color: '#0055BB',
            background: 'none', border: '1.5px solid rgba(0,85,187,0.25)',
            borderRadius: '9999px', padding: '4px 12px', cursor: 'pointer',
            transition: 'all 120ms ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(0,85,187,0.06)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          View activity
        </button>
      </div>
    </div>
  )
}

// ── Activity feed entry ───────────────────────────────────────────────────────
function ActivityEntry({ entry, onOpenKol }) {
  const kol = kolsData.find((k) => k.id === entry.kolId)
  const cfg = ACTIVITY_CONFIG[entry.activityType] ?? ACTIVITY_CONFIG['Publication']
  const { Icon } = cfg

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '16px',
      border: '1px solid rgba(5,10,68,0.08)', padding: '16px 20px',
    }}>
      {/* Meta row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'rgba(5,10,68,0.40)', whiteSpace: 'nowrap' }}>
          {entry.date}
        </span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '2px 8px', borderRadius: '9999px',
          fontSize: '11px', fontWeight: 700,
          background: cfg.bg, color: cfg.text,
        }}>
          <Icon size={10} />
          {entry.activityType}
        </span>
        {kol && (
          <button
            onClick={() => onOpenKol(kol.id)}
            style={{
              fontSize: '12px', fontWeight: 600, color: 'rgba(5,10,68,0.75)',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 0, textDecoration: 'underline',
            }}
          >
            {kol.name}
          </button>
        )}
        {kol && kol.affiliations.length === 0 && (
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.45)' }}>
            Independent
          </span>
        )}
        {kol && kol.affiliations.map((id) => <AffBadge key={id} id={id} />)}
      </div>

      <p style={{ margin: '0 0 6px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.88)', lineHeight: '1.4' }}>
        {entry.headline}
      </p>
      <p style={{ margin: '0 0 10px', fontSize: '13px', color: 'rgba(5,10,68,0.65)', lineHeight: '1.60' }}>
        {entry.summary}
      </p>

      <div style={{ background: '#E8EAF6', borderRadius: '8px', padding: '8px 12px' }}>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.55' }}>
          <strong style={{
            color: 'rgba(5,10,68,0.50)', fontWeight: 600,
            fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>
            Why it matters —{' '}
          </strong>
          {entry.whyItMatters}
        </p>
      </div>
    </div>
  )
}

// ── Filter chip ───────────────────────────────────────────────────────────────
function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 13px', borderRadius: '9999px',
        fontSize: '12px', fontWeight: active ? 700 : 500,
        background: active ? '#050A44' : 'transparent',
        color: active ? '#FFFFFF' : 'rgba(5,10,68,0.55)',
        border: `1.5px solid ${active ? '#050A44' : 'rgba(5,10,68,0.15)'}`,
        cursor: 'pointer', transition: 'all 120ms ease', whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function KOLEngagementTab({ initialKolId }) {
  const { openAskModal } = useApp()
  const [activeFilter, setActiveFilter] = useState('all')
  const [openKolId, setOpenKolId] = useState(initialKolId || null)

  const openKol = kolsData.find((k) => k.id === openKolId)

  // Filtered KOLs (used by roster + activity, not appearances)
  const filteredKols = kolsData.filter((kol) => {
    if (activeFilter === 'all') return true
    if (activeFilter === 'independent') return kol.affiliations.length === 0
    return kol.affiliations.includes(activeFilter)
  })

  const filteredActivity = kolActivityData.filter((entry) => {
    if (activeFilter === 'all') return true
    const kol = kolsData.find((k) => k.id === entry.kolId)
    if (!kol) return false
    if (activeFilter === 'independent') return kol.affiliations.length === 0
    return kol.affiliations.includes(activeFilter)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* Filter bar + Ask Ariya */}
      <div style={{
        background: '#FFFFFF', borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
      }}>
        <Chip label="All KOLs"     active={activeFilter === 'all'}         onClick={() => setActiveFilter('all')} />
        <Chip label="Takeda"       active={activeFilter === 'takeda'}      onClick={() => setActiveFilter('takeda')} />
        <Chip label="BioCryst"     active={activeFilter === 'biocryst'}    onClick={() => setActiveFilter('biocryst')} />
        <Chip label="Pharvaris"    active={activeFilter === 'pharvaris'}   onClick={() => setActiveFilter('pharvaris')} />
        <Chip label="Independent"  active={activeFilter === 'independent'} onClick={() => setActiveFilter('independent')} />
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={() => openAskModal('kol-engagement-tab')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '7px 14px', borderRadius: '9999px',
              fontSize: '13px', fontWeight: 600,
              background: '#050A44', color: '#FFFFFF',
              border: 'none', cursor: 'pointer',
              transition: 'transform 120ms ease, box-shadow 120ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(5,10,68,0.25)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
          >
            <Sparkles size={13} />
            Ask Ariya about KOL landscape
          </button>
        </div>
      </div>

      {/* ── Section 1: KOL roster ──────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <p style={{
            margin: 0, fontSize: '11px', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.10em',
            color: 'rgba(5,10,68,0.38)',
          }}>
            {filteredKols.length} tracked KOL{filteredKols.length !== 1 ? 's' : ''}
          </p>
          <p style={{ margin: 0, fontSize: '11px', color: 'rgba(5,10,68,0.35)', fontStyle: 'italic' }}>
            Curated list — updated quarterly
          </p>
        </div>

        {filteredKols.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(5,10,68,0.35)', fontSize: '14px' }}>
            No KOLs match the current filter.
          </p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {filteredKols.map((kol) => (
              <KOLCard key={kol.id} kol={kol} onOpen={setOpenKolId} />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Recent KOL activity ────────────────────────────────── */}
      <div>
        <p style={{
          margin: '0 0 12px', fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.10em',
          color: 'rgba(5,10,68,0.38)',
        }}>
          Recent KOL activity
        </p>
        {filteredActivity.length === 0 ? (
          <p style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(5,10,68,0.35)', fontSize: '14px' }}>
            No activity matches the current filter.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {filteredActivity.map((entry) => (
              <ActivityEntry key={entry.id} entry={entry} onOpenKol={setOpenKolId} />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3: Upcoming appearances ───────────────────────────────── */}
      <div>
        <p style={{
          margin: '0 0 12px', fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.10em',
          color: 'rgba(5,10,68,0.38)',
        }}>
          Upcoming KOL appearances
        </p>
        <div style={{
          background: '#FFFFFF', borderRadius: '16px',
          border: '1px solid rgba(5,10,68,0.08)', overflow: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(5,10,68,0.08)' }}>
                {['Date', 'Congress', 'KOL', 'Session title', 'Affiliated with', 'Notes'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 14px', textAlign: 'left',
                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.08em', color: 'rgba(5,10,68,0.35)', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {kolAppearancesData.map((app, i) => {
                const kol = kolsData.find((k) => k.id === app.kolId)
                return (
                  <tr
                    key={app.id}
                    style={{ borderBottom: i < kolAppearancesData.length - 1 ? '1px solid rgba(5,10,68,0.06)' : 'none' }}
                  >
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'rgba(5,10,68,0.60)', whiteSpace: 'nowrap' }}>
                      {app.date}
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'rgba(5,10,68,0.75)', fontWeight: 500 }}>
                      {app.congress}
                    </td>
                    <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={() => setOpenKolId(app.kolId)}
                        style={{
                          fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.80)',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, textDecoration: 'underline',
                        }}
                      >
                        {kol?.name}
                      </button>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '13px', color: 'rgba(5,10,68,0.70)' }}>
                      {app.sessionTitle}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {app.affiliatedWith.length === 0
                          ? <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '9999px', background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.45)' }}>Independent</span>
                          : app.affiliatedWith.map((id) => <AffBadge key={id} id={id} />)
                        }
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: '12px', color: 'rgba(5,10,68,0.55)', fontStyle: 'italic' }}>
                      {app.notes}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* KOL detail modal */}
      {openKol && <KOLModal kol={openKol} onClose={() => setOpenKolId(null)} />}

    </div>
  )
}
