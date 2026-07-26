import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, ChevronLeft, Bell, ChevronDown } from 'lucide-react'

const FORMAT_OPTIONS = [
  { value: 'narrative',  label: 'Narrative summary', description: 'Conversational prose, contextualized takeaways' },
  { value: 'structured', label: 'Structured brief',  description: 'Headlines, bullets, clear sections' },
  { value: 'raw',        label: 'Raw signal',        description: 'Source extracts only, minimal interpretation' },
]

const DIGEST_BULLETS = [
  'Pharvaris RAPIDe-3 completion date tightened by 6 weeks — oral on-demand window narrows.',
  'BioCryst Q1 earnings: HAE net revenue $89M, up 12% YoY. Management tone on prophylaxis switching remains cautious.',
  'CSL Behring confirms Andembry formulary access in Germany ahead of schedule.',
]

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div
      role="switch"
      aria-checked={on}
      className="ariya-focus"
      tabIndex={0}
      onClick={() => onChange(!on)}
      onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') onChange(!on) }}
      style={{
        width: '42px', height: '24px', borderRadius: '9999px',
        background: on ? '#2A76F4' : 'rgba(5,10,68,0.15)',
        position: 'relative', flexShrink: 0, cursor: 'pointer',
        transition: 'background 150ms ease',
      }}
    >
      <div style={{
        position: 'absolute', top: '3px',
        left: on ? '21px' : '3px',
        width: '18px', height: '18px', borderRadius: '50%',
        background: '#FFFFFF',
        transition: 'left 150ms ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.20)',
      }} />
    </div>
  )
}

// ── Sub-section label ─────────────────────────────────────────────────────────
function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: '0 0 8px',
      fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.10em',
      color: 'var(--ink-600)',
    }}>
      {children}
    </p>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyAlerts() {
  const [format, setFormat] = useState(() =>
    localStorage.getItem('ariya-delivery-format') || 'structured'
  )
  const [teamsEnabled, setTeamsEnabled] = useState(() =>
    localStorage.getItem('ariya-channel-teams') !== 'false'
  )

  function updateFormat(value: string) {
    setFormat(value)
    localStorage.setItem('ariya-delivery-format', value)
  }

  function updateTeams(value: boolean) {
    setTeamsEnabled(value)
    localStorage.setItem('ariya-channel-teams', String(value))
  }

  return (
    <div style={{ padding: '20px 36px 36px' }}>

      {/* Breadcrumb */}
      <Link
        to="/myspace"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '14px', fontWeight: 500,
          fontFamily: 'Satoshi, sans-serif', color: 'rgba(5,10,68,0.55)',
          textDecoration: 'none', marginBottom: '12px',
        }}
      >
        <ChevronLeft size={15} strokeWidth={2} />
        My Space
      </Link>

      {/* Page title + subtitle */}
      <h1 style={{
        margin: '0 0 4px',
        fontSize: '28px', fontWeight: 700,
        fontFamily: 'Satoshi, sans-serif', color: '#10224A',
        lineHeight: '1.2',
      }}>
        My Alerts
      </h1>
      <p style={{
        margin: '0 0 28px',
        fontSize: '14px', fontFamily: 'Inter, sans-serif',
        color: 'rgba(5,10,68,0.50)', lineHeight: '1.5',
      }}>
        How and when Ariya delivers signals to you.
      </p>

      {/* ── CARD 1: Delivery preferences ─────────────────────────────────────── */}
      <section style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(210,226,255,1)',
        padding: '24px',
        marginBottom: '16px',
      }}>
        <p style={{
          margin: '0 0 2px',
          fontSize: '16px', fontWeight: 600,
          fontFamily: 'Satoshi, sans-serif', color: '#10224A',
        }}>
          Delivery preferences
        </p>
        <p style={{
          margin: '0 0 20px',
          fontSize: '13px', fontFamily: 'Inter, sans-serif',
          color: 'rgba(5,10,68,0.50)', lineHeight: '1.5',
        }}>
          How and when Ariya sends you signals.
        </p>

        {/* SCHEDULED DELIVERY */}
        <div style={{ marginBottom: '20px' }}>
          <SubLabel>Scheduled delivery</SubLabel>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px 14px',
            background: '#FAFBFF',
            border: '1px solid rgba(210,226,255,1)',
            borderRadius: '8px',
            cursor: 'default',
          }}>
            <Mail size={15} color="var(--ink-600)" strokeWidth={1.5} />
            <span style={{
              flex: 1,
              fontSize: '14px', fontFamily: 'Satoshi, sans-serif',
              color: '#434c5b', fontWeight: 400,
            }}>
              Weekly digest — Monday 07:00 — Email
            </span>
            <ChevronDown size={15} color="var(--ink-600)" strokeWidth={1.5} />
          </div>
        </div>

        {/* REAL-TIME PUSH */}
        <div style={{ marginBottom: '20px' }}>
          <SubLabel>Real-time push</SubLabel>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '10px 14px',
            background: '#FAFBFF',
            border: '1px solid rgba(210,226,255,1)',
            borderRadius: '8px',
          }}>
            <Bell size={15} color="var(--ink-600)" strokeWidth={1.5} />
            <span style={{
              flex: 1,
              fontSize: '14px', fontFamily: 'Satoshi, sans-serif',
              color: '#434c5b', fontWeight: 400,
            }}>
              High-priority alerts — Microsoft Teams
            </span>
            <Toggle on={teamsEnabled} onChange={updateTeams} />
          </div>
        </div>

        {/* FORMAT */}
        <div>
          <SubLabel>Format</SubLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {FORMAT_OPTIONS.map((opt) => {
              const isSelected = format === opt.value
              return (
                <label
                  key={opt.value}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '12px',
                    padding: '10px 14px', borderRadius: '8px',
                    border: `1px solid ${isSelected ? '#2A76F4' : 'rgba(210,226,255,1)'}`,
                    background: isSelected ? 'rgba(42,118,244,0.04)' : '#FFFFFF',
                    cursor: 'pointer', transition: 'all 120ms ease',
                  }}
                >
                  <input
                    type="radio"
                    name="delivery-format"
                    value={opt.value}
                    checked={isSelected}
                    onChange={() => updateFormat(opt.value)}
                    style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#2A76F4' }}
                  />
                  <div>
                    <p style={{
                      margin: '0 0 2px',
                      fontSize: '14px', fontWeight: isSelected ? 600 : 400,
                      fontFamily: 'Satoshi, sans-serif', color: '#434c5b',
                    }}>
                      {opt.label}
                    </p>
                    <p style={{
                      margin: 0,
                      fontSize: '13px', fontFamily: 'Inter, sans-serif',
                      color: 'rgba(5,10,68,0.50)',
                    }}>
                      {opt.description}
                    </p>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── CARD 2: Weekly digest preview ─────────────────────────────────────── */}
      <section style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(210,226,255,1)',
        padding: '24px',
      }}>
        <p style={{
          margin: '0 0 2px',
          fontSize: '16px', fontWeight: 600,
          fontFamily: 'Satoshi, sans-serif', color: '#10224A',
        }}>
          Weekly digest preview
        </p>
        <p style={{
          margin: '0 0 16px',
          fontSize: '13px', fontFamily: 'Inter, sans-serif',
          color: 'rgba(5,10,68,0.50)', lineHeight: '1.5',
        }}>
          Preview of your next Monday digest.
        </p>

        <div style={{
          border: '1px solid rgba(42,118,244,0.18)',
          borderRadius: '8px',
          background: 'rgba(42,118,244,0.03)',
          padding: '14px 18px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '12px', paddingBottom: '10px',
            borderBottom: '1px solid rgba(5,10,68,0.06)',
          }}>
            <Mail size={14} color="#2A76F4" strokeWidth={1.5} />
            <span style={{
              fontSize: '11px', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: '#2A76F4',
            }}>
              Subject: Your Ariya weekly digest — Monday 07:00
            </span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', listStyleType: 'disc' }}>
            {DIGEST_BULLETS.map((b, i) => (
              <li key={i} style={{
                fontSize: '13px', fontFamily: 'Inter, sans-serif',
                color: '#434c5b', lineHeight: '1.65',
                marginBottom: i < DIGEST_BULLETS.length - 1 ? '6px' : 0,
              }}>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

    </div>
  )
}
