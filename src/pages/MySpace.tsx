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
      className="hover-lift"
      style={{
        textDecoration: 'none',
        background: '#FFFFFF',
        borderRadius: '20px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 8px 24px rgba(5,10,68,0.04)',
        padding: '24px 28px',
        display: 'flex', alignItems: 'flex-start', gap: '18px',
      }}
    >
      <div style={{
        width: '44px', height: '44px', borderRadius: '12px',
        background: '#E8EAF6', display: 'flex',
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color="#0055BB" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
            {section.title}
          </h2>
          <ArrowRight size={14} color="rgba(5,10,68,0.40)" />
        </div>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.58)', lineHeight: '1.55' }}>
          {section.description}
        </p>
      </div>
    </Link>
  )
}

export default function MySpace() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: '880px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          My Space
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
          Tailor how Ariya delivers signals to you and store your private reference documents.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {SECTIONS.map((s) => (
          <SectionLinkCard key={s.to} section={s} />
        ))}
      </div>
    </div>
  )
}
