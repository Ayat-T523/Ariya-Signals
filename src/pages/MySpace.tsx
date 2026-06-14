import { Link } from 'react-router-dom'
import { Bell, FileText, ArrowRight, Lock } from 'lucide-react'

const SECTIONS = [
  {
    to: '/myspace/alerts',
    icon: Bell,
    title: 'My Alerts',
    description: 'Configure delivery preferences — scheduled digests, real-time push, and the format Ariya uses to summarise signals for you.',
    disabled: false,
  },
  {
    to: '/myspace/documents',
    icon: FileText,
    title: 'My Documents',
    description: 'Upload private reference documents that Ariya uses to tailor your signals. Your documents are never shared with other users.',
    disabled: true,
  },
]

function SectionLinkCard({ section }) {
  const Icon = section.icon

  if (section.disabled) {
    return (
      <div
        style={{
          textDecoration: 'none',
          background: 'rgba(5,10,68,0.03)',
          borderRadius: '12px',
          border: '1px solid rgba(210,226,255,0.6)',
          padding: '20px 24px',
          display: 'flex', alignItems: 'flex-start', gap: '16px',
          cursor: 'not-allowed',
          opacity: 0.6,
        }}
      >
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'rgba(5,10,68,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Icon size={18} color="rgba(5,10,68,0.35)" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <h2 style={{
              margin: 0, fontSize: '15px', fontWeight: 500,
              fontFamily: 'Satoshi, sans-serif', color: 'rgba(5,10,68,0.45)',
            }}>
              {section.title}
            </h2>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '4px',
              padding: '2px 8px', borderRadius: '9999px',
              fontSize: '11px', fontWeight: 600,
              background: 'rgba(5,10,68,0.08)', color: 'rgba(5,10,68,0.50)',
              fontFamily: 'Satoshi, sans-serif',
            }}>
              <Lock size={10} />
              Paid package
            </span>
          </div>
          <p style={{
            margin: 0, fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            color: 'rgba(5,10,68,0.40)', lineHeight: '1.55',
          }}>
            {section.description}
          </p>
        </div>
      </div>
    )
  }

  return (
    <Link
      to={section.to}
      style={{
        textDecoration: 'none',
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(210,226,255,1)',
        padding: '20px 24px',
        display: 'flex', alignItems: 'flex-start', gap: '16px',
      }}
    >
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: 'rgba(42,118,244,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color="#2A76F4" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <h2 style={{
            margin: 0, fontSize: '15px', fontWeight: 500,
            fontFamily: 'Satoshi, sans-serif', color: '#434c5b',
          }}>
            {section.title}
          </h2>
          <ArrowRight size={14} color="rgba(5,10,68,0.35)" />
        </div>
        <p style={{
          margin: 0, fontSize: '13px',
          fontFamily: 'Inter, sans-serif',
          color: 'rgba(5,10,68,0.65)', lineHeight: '1.55',
        }}>
          {section.description}
        </p>
      </div>
    </Link>
  )
}

export default function MySpace() {
  return (
    <div data-tour="myspace-page" style={{ padding: '20px 36px 36px' }}>
      <p style={{
        margin: '0 0 28px',
        fontSize: '14px', fontFamily: 'Inter, sans-serif',
        color: '#434c5b', lineHeight: '1.5',
      }}>
        Tailor how Ariya delivers signals to you and store your private reference documents.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {SECTIONS.map((s) => (
          <SectionLinkCard key={s.to} section={s} />
        ))}
      </div>
    </div>
  )
}
