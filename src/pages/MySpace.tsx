import { Link } from 'react-router-dom'
import { Bell, FileText, ArrowRight } from 'lucide-react'

const SECTIONS = [
  {
    to: '/myspace/alerts',
    icon: Bell,
    title: 'My Alerts',
    description: 'Configure delivery preferences — scheduled digests, real-time push, and the format Ariya uses to summarise signals for you.',
  },
  {
    to: '/myspace/documents',
    icon: FileText,
    title: 'My Documents',
    description: 'Upload private reference documents that Ariya uses to tailor your signals. Your documents are never shared with other users.',
  },
]

function SectionLinkCard({ section }) {
  const Icon = section.icon
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
      {/* Icon */}
      <div style={{
        width: '40px', height: '40px', borderRadius: '10px',
        background: 'rgba(42,118,244,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={18} color="#2A76F4" />
      </div>

      {/* Content */}
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
