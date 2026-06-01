import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Bell, ChevronLeft } from 'lucide-react'

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

function SectionCard({ title, description, children }) {
  return (
    <section style={{
      background: '#FFFFFF', borderRadius: '20px',
      border: '1px solid rgba(5,10,68,0.08)',
      boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 4px 12px rgba(5,10,68,0.04)',
      padding: '24px 28px', marginBottom: '20px',
    }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
        {title}
      </h2>
      {description && (
        <p style={{ margin: '0 0 18px', fontSize: '13px', color: 'rgba(5,10,68,0.55)' }}>
          {description}
        </p>
      )}
      {children}
    </section>
  )
}

function FieldLabel({ children }) {
  return (
    <p style={{
      margin: '0 0 6px', fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'rgba(5,10,68,0.45)',
    }}>
      {children}
    </p>
  )
}

export default function MyAlerts() {
  const [format, setFormat] = useState(() => {
    return localStorage.getItem('ariya-delivery-format') || 'structured'
  })

  const updateFormat = (value) => {
    setFormat(value)
    localStorage.setItem('ariya-delivery-format', value)
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '880px' }}>
      {/* Breadcrumb */}
      <Link
        to="/myspace"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'rgba(5,10,68,0.45)', textDecoration: 'none', marginBottom: '16px' }}
      >
        <ChevronLeft size={14} />
        My Space
      </Link>

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          My Alerts
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
          How and when Ariya delivers signals to you.
        </p>
      </div>

      {/* ── Delivery preferences ─────────────────────────────────────────── */}
      <SectionCard title="Delivery preferences" description="How and when Ariya sends you signals.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Scheduled delivery */}
          <div>
            <FieldLabel>Scheduled delivery</FieldLabel>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '10px',
              border: '1.5px solid rgba(5,10,68,0.12)', background: '#FFFFFF',
            }}>
              <Mail size={14} color="rgba(5,10,68,0.45)" />
              <select
                disabled
                value="weekly-mon-7"
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: '13px', color: 'rgba(5,10,68,0.75)', fontFamily: 'inherit',
                  cursor: 'not-allowed', outline: 'none',
                }}
              >
                <option value="weekly-mon-7">Weekly digest — Monday 07:00 — Email</option>
              </select>
            </div>
          </div>

          {/* Real-time push */}
          <div>
            <FieldLabel>Real-time push</FieldLabel>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '10px 14px', borderRadius: '10px',
              border: '1.5px solid rgba(5,10,68,0.12)', background: '#FFFFFF',
            }}>
              <Bell size={14} color="rgba(5,10,68,0.45)" />
              <p style={{ margin: 0, flex: 1, fontSize: '13px', color: 'rgba(5,10,68,0.75)' }}>
                High-priority alerts — Microsoft Teams
              </p>
              <div
                role="switch"
                aria-checked="true"
                style={{
                  width: '36px', height: '20px', borderRadius: '9999px',
                  background: '#050A44', position: 'relative', flexShrink: 0,
                  opacity: 0.7,
                }}
              >
                <div style={{
                  position: 'absolute', top: '2px', left: '18px',
                  width: '16px', height: '16px', borderRadius: '50%',
                  background: '#FFFFFF',
                }} />
              </div>
            </div>
          </div>

          {/* Format */}
          <div>
            <FieldLabel>Format</FieldLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {FORMAT_OPTIONS.map((opt) => {
                const isSelected = format === opt.value
                return (
                  <label
                    key={opt.value}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      padding: '10px 14px', borderRadius: '10px',
                      border: `1.5px solid ${isSelected ? '#050A44' : 'rgba(5,10,68,0.12)'}`,
                      background: isSelected ? 'rgba(5,10,68,0.03)' : '#FFFFFF',
                      cursor: 'pointer', transition: 'all 120ms ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="delivery-format"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => updateFormat(opt.value)}
                      style={{ marginTop: '3px', cursor: 'pointer', accentColor: '#050A44' }}
                    />
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.92)' }}>
                        {opt.label}
                      </p>
                      <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.55)' }}>
                        {opt.description}
                      </p>
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Weekly digest preview ────────────────────────────────────────── */}
      <SectionCard title="Weekly digest preview" description="Preview of your next Monday digest.">
        <div style={{
          border: '1px solid rgba(5,10,68,0.10)', borderRadius: '12px',
          background: '#FAFBFE', padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(5,10,68,0.08)' }}>
            <Mail size={14} color="#0055BB" />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#0055BB' }}>
              Subject: Your Ariya weekly digest — Monday 07:00
            </span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', listStyleType: 'disc' }}>
            {DIGEST_BULLETS.map((b, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'rgba(5,10,68,0.72)', lineHeight: '1.6', marginBottom: i < DIGEST_BULLETS.length - 1 ? '6px' : 0 }}>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>
    </div>
  )
}
