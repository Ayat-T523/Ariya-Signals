import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload, FileText, ChevronLeft } from 'lucide-react'

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

export default function MyDocuments() {
  const [uploadDescription, setUploadDescription] = useState('')

  const handleUploadClick = () => {
    alert('Personal uploads available in the full version.')
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
          My Documents
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
          Private uploads that Ariya uses to tailor your signals.
        </p>
      </div>

      <SectionCard title="My documents" description="Private uploads that Ariya uses to tailor your signals.">
        <div
          style={{
            border: '2px dashed rgba(5,10,68,0.18)', borderRadius: '14px',
            padding: '24px 20px', textAlign: 'center', background: '#FAFBFE',
          }}
        >
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%',
            background: 'rgba(5,10,68,0.06)', margin: '0 auto 10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Upload size={18} color="rgba(5,10,68,0.45)" />
          </div>
          <p style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 600, color: 'rgba(5,10,68,0.75)' }}>
            Upload a PDF, Word, PowerPoint, Excel, or image.
          </p>
          <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.45)' }}>
            Your documents are private and never shared with other users.
          </p>
        </div>

        <div style={{ marginTop: '16px' }}>
          <FieldLabel>What is this document and what should Ariya use it for?</FieldLabel>
          <input
            value={uploadDescription}
            onChange={(e) => setUploadDescription(e.target.value)}
            placeholder="e.g. Pharvaris congress presentation I attended at EAACI 2026"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: '8px',
              border: '1.5px solid rgba(5,10,68,0.15)',
              fontSize: '13px', color: 'rgba(5,10,68,0.88)',
              background: '#FFFFFF', fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        <button
          onClick={handleUploadClick}
          style={{
            marginTop: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '9px 18px', borderRadius: '9999px',
            background: 'rgba(5,10,68,0.10)', color: 'rgba(5,10,68,0.45)',
            border: 'none', fontSize: '13px', fontWeight: 600,
            cursor: 'not-allowed',
          }}
          title="Personal uploads available in the full version"
        >
          <FileText size={13} />
          Upload
        </button>
      </SectionCard>
    </div>
  )
}
