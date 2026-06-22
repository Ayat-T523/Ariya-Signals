import { Link } from 'react-router-dom'
import { Upload, FileText, ChevronLeft, File, SlidersHorizontal } from 'lucide-react'
import { DEMO } from '../config/demo-config'
import { useConfig } from '../context/AppContext'

const CAPABILITY_REQUEST_URL = DEMO.capabilityRequestUrl

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  PDF:        { bg: 'rgba(225,29,72,0.08)',   text: '#C01041' },
  Word:       { bg: 'rgba(0,85,187,0.08)',    text: '#0055BB' },
  PowerPoint: { bg: 'rgba(245,158,11,0.10)',  text: '#92500A' },
  Excel:      { bg: 'rgba(16,185,129,0.10)',  text: '#065F46' },
}

export default function MyDocuments() {
  const { assetName } = useConfig()
  const MOCK_DOCUMENTS = [
    { name: 'Pharvaris EAACI 2026 symposium deck.pdf',              type: 'PDF',        date: 'Apr 15, 2026', size: '4.2 MB', status: 'Indexed', icon: File },
    { name: `Internal ${assetName} launch readiness brief.docx`,   type: 'Word',       date: 'Mar 28, 2026', size: '1.1 MB', status: 'Indexed', icon: FileText },
    { name: 'BioCryst investor day slides - annotated.pptx',        type: 'PowerPoint', date: 'Mar 12, 2026', size: '8.7 MB', status: 'Indexed', icon: SlidersHorizontal },
  ]
  return (
    <div style={{ padding: '28px 32px', maxWidth: '880px' }}>

      {/* Breadcrumb */}
      <Link
        to="/myspace"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          fontSize: '13px', color: 'rgba(5,10,68,0.45)',
          textDecoration: 'none', marginBottom: '16px',
        }}
      >
        <ChevronLeft size={14} />
        My Space
      </Link>

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
            My Documents
          </h1>
          <span style={{
            padding: '3px 10px', borderRadius: '9999px',
            fontSize: '11px', fontWeight: 700,
            background: 'rgba(42,118,244,0.12)', color: '#2A76F4',
            letterSpacing: '0.04em',
            whiteSpace: 'nowrap',
          }}>
            Full product
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#434c5b', lineHeight: '1.6', maxWidth: '600px' }}>
          Bring your own intelligence. Upload internal decks, annotated publications, and field notes — Ariya indexes them privately and incorporates them into your signals and Ask queries. Your documents are never shared with other users.
        </p>
      </div>

      {/* ── Mock document list ─────────────────────────────────────────────────── */}
      <section style={{
        background: '#FFFFFF', borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 4px 12px rgba(5,10,68,0.04)',
        marginBottom: '20px', overflow: 'hidden',
      }}>
        {/* Section header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(5,10,68,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>
              Indexed documents
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>
              3 documents · illustrative
            </p>
          </div>
          <span style={{
            padding: '4px 10px', borderRadius: '6px',
            fontSize: '11px', fontWeight: 600,
            background: 'rgba(73,160,120,0.12)', color: '#49a078',
          }}>
            All indexed
          </span>
        </div>

        {/* Document rows */}
        {MOCK_DOCUMENTS.map((doc, i) => {
          const typeCfg = TYPE_COLORS[doc.type] ?? TYPE_COLORS.PDF
          const DocIcon = doc.icon
          return (
            <div
              key={i}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 24px',
                borderBottom: i < MOCK_DOCUMENTS.length - 1 ? '1px solid rgba(5,10,68,0.05)' : 'none',
              }}
            >
              {/* Icon */}
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: typeCfg.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <DocIcon size={16} color={typeCfg.text} strokeWidth={1.5} />
              </div>

              {/* Name + meta */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'rgba(5,10,68,0.88)', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {doc.name}
                </p>
                <p style={{ margin: '3px 0 0', fontSize: '12px', color: 'rgba(5,10,68,0.40)' }}>
                  {doc.date} · {doc.size}
                </p>
              </div>

              {/* Type badge */}
              <span style={{
                padding: '3px 8px', borderRadius: '6px',
                fontSize: '11px', fontWeight: 600,
                background: typeCfg.bg, color: typeCfg.text,
                flexShrink: 0,
              }}>
                {doc.type}
              </span>

              {/* Status badge */}
              <span style={{
                padding: '3px 8px', borderRadius: '6px',
                fontSize: '11px', fontWeight: 600,
                background: 'rgba(73,160,120,0.12)', color: '#49a078',
                flexShrink: 0,
              }}>
                {doc.status}
              </span>
            </div>
          )
        })}
      </section>

      {/* ── Upload area (disabled showcase) ────────────────────────────────────── */}
      <section style={{
        background: '#FAFBFE', borderRadius: '16px',
        border: '2px dashed rgba(5,10,68,0.12)',
        padding: '32px 24px', textAlign: 'center',
        marginBottom: '20px',
      }}>
        <div style={{
          width: '44px', height: '44px', borderRadius: '50%',
          background: 'rgba(5,10,68,0.06)', margin: '0 auto 12px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Upload size={20} color="rgba(5,10,68,0.35)" />
        </div>
        <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.55)' }}>
          Upload a PDF, Word, PowerPoint, or Excel file
        </p>
        <p style={{ margin: '0 0 16px', fontSize: '12px', color: 'rgba(5,10,68,0.38)' }}>
          Up to 50 MB · Your documents are private and never shared
        </p>
        <span style={{
          display: 'inline-block',
          padding: '5px 14px', borderRadius: '8px',
          fontSize: '12px', fontWeight: 500,
          background: 'rgba(5,10,68,0.06)', color: 'rgba(5,10,68,0.40)',
          cursor: 'not-allowed',
        }}>
          Document upload is available in the full product
        </span>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#FFFFFF', borderRadius: '12px',
        border: '1px solid rgba(42,118,244,0.20)',
        padding: '18px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      }}>
        <div>
          <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.88)' }}>
            Interested in this capability?
          </p>
          <p style={{ margin: 0, fontSize: '13px', fontFamily: 'Inter, sans-serif', color: 'rgba(5,10,68,0.55)' }}>
            Contact your Ariya account team to enable My Documents for your organisation.
          </p>
        </div>
        <a
          href={CAPABILITY_REQUEST_URL}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '9px 20px', borderRadius: '9999px',
            background: '#050A44', color: '#FFFFFF',
            fontSize: '13px', fontWeight: 600,
            textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          Request this capability
        </a>
      </div>

    </div>
  )
}
