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

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({ title, description, children }) {
  return (
    <section style={{
      background: '#FFFFFF',
      borderRadius: '12px',
      border: '1px solid rgba(210,226,255,1)',
      padding: '20px 24px',
      marginBottom: '16px',
    }}>
      <p style={{
        margin: '0 0 4px',
        fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.40)',
      }}>
        {title}
      </p>
      {description && (
        <p style={{
          margin: '0 0 16px', fontSize: '14px',
          fontFamily: 'Inter, sans-serif',
          color: '#434c5b', lineHeight: '1.5',
        }}>
          {description}
        </p>
      )}
      {children}
    </section>
  )
}

// ── Field label ───────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return (
    <p style={{
      margin: '0 0 6px', fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.09em',
      color: 'rgba(5,10,68,0.50)',
    }}>
      {children}
    </p>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MyAlerts() {
  const [format, setFormat] = useState(() => {
    return localStorage.getItem('ariya-delivery-format') || 'structured'
  })

  const updateFormat = (value) => {
    setFormat(value)
    localStorage.setItem('ariya-delivery-format', value)
  }

  return (
    <div style={{ padding: '20px 36px 36px' }}>

      {/* Breadcrumb */}
      <Link
        to="/myspace"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '14px', fontWeight: 600,
          fontFamily: 'Satoshi, sans-serif', color: '#10224A',
          textDecoration: 'none', marginBottom: '16px',
        }}
      >
        <ChevronLeft size={16} />
        My Space
      </Link>

      {/* Description */}
      <p style={{ margin: '0 0 24px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#434c5b', lineHeight: '1.5' }}>
        How and when Ariya delivers signals to you.
      </p>

      {/* ── Delivery preferences ─────────────────────────────────────────────── */}
      <SectionCard title="Delivery preferences" description="Configure when and how Ariya sends you signals.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Scheduled delivery */}
          <div>
            <FieldLabel>Scheduled delivery</FieldLabel>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 14px', borderRadius: '8px',
              border: '1px solid rgba(210,226,255,1)', background: '#FFFFFF',
            }}>
              <Mail size={14} color="rgba(5,10,68,0.45)" />
              <select
                disabled
                value="weekly-mon-7"
                style={{
                  flex: 1, border: 'none', background: 'transparent',
                  fontSize: '13px', fontFamily: 'Inter, sans-serif',
                  color: 'rgba(5,10,68,0.75)', cursor: 'not-allowed', outline: 'none',
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
              padding: '10px 14px', borderRadius: '8px',
              border: '1px solid rgba(210,226,255,1)', background: '#FFFFFF',
            }}>
              <Bell size={14} color="rgba(5,10,68,0.45)" />
              <p style={{ margin: 0, flex: 1, fontSize: '13px', fontFamily: 'Inter, sans-serif', color: 'rgba(5,10,68,0.75)' }}>
                High-priority alerts — Microsoft Teams
              </p>
              <div
                role="switch"
                aria-checked="true"
                style={{
                  width: '36px', height: '20px', borderRadius: '9999px',
                  background: '#2A76F4', position: 'relative', flexShrink: 0,
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
                      padding: '10px 14px', borderRadius: '8px',
                      border: `1px solid ${isSelected ? '#2A76F4' : 'rgba(210,226,255,1)'}`,
                      background: isSelected ? 'rgba(42,118,244,0.06)' : '#FFFFFF',
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
                      <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 500, fontFamily: 'Satoshi, sans-serif', color: '#434c5b' }}>
                        {opt.label}
                      </p>
                      <p style={{ margin: 0, fontSize: '13px', fontFamily: 'Inter, sans-serif', color: 'rgba(5,10,68,0.55)' }}>
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

      {/* ── Weekly digest preview ─────────────────────────────────────────────── */}
      <SectionCard title="Weekly digest preview" description="Preview of your next Monday digest.">
        <div style={{
          border: '1px solid rgba(210,226,255,1)', borderRadius: '8px',
          background: 'rgba(42,118,244,0.04)', padding: '16px 20px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            marginBottom: '12px', paddingBottom: '10px',
            borderBottom: '1px solid rgba(5,10,68,0.06)',
          }}>
            <Mail size={14} color="#2A76F4" />
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2A76F4' }}>
              Subject: Your Ariya weekly digest — Monday 07:00
            </span>
          </div>
          <ul style={{ margin: 0, padding: '0 0 0 18px', listStyleType: 'disc' }}>
            {DIGEST_BULLETS.map((b, i) => (
              <li key={i} style={{
                fontSize: '13px', fontFamily: 'Inter, sans-serif',
                color: '#434c5b', lineHeight: '1.6',
                marginBottom: i < DIGEST_BULLETS.length - 1 ? '6px' : 0,
              }}>
                {b}
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

    </div>
  )
}
