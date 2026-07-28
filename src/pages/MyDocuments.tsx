import { Link } from 'react-router-dom'
import { Upload, ChevronLeft, FolderOpen } from 'lucide-react'
import { DEMO } from '../config/demo-config'

const CAPABILITY_REQUEST_URL = DEMO.capabilityRequestUrl

/**
 * There is deliberately no document list here.
 *
 * This page used to render three invented documents ("Pharvaris EAACI 2026
 * symposium deck.pdf", 4.2 MB, "Indexed") behind a small "3 documents ·
 * illustrative" caption. Document upload is a full-product capability with no
 * backing store in this build, so there is nothing those rows could be wired to
 * and no honest way to show them: a file list is read as a record of files that
 * exist. Fabricated filenames with fabricated sizes and index statuses are
 * exactly the kind of plausible detail that survives being labelled.
 *
 * The empty state below says the true thing instead. When the capability ships,
 * this is where the real list goes.
 */

export default function MyDocuments() {
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

      {/* ── Document list: empty until the capability is enabled ───────────────── */}
      <section style={{
        background: '#FFFFFF', borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 4px 12px rgba(5,10,68,0.04)',
        marginBottom: '20px', overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(5,10,68,0.06)',
        }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>
            Indexed documents
          </h2>
        </div>

        <div style={{
          padding: '40px 24px', textAlign: 'center',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px',
            background: 'rgba(5,10,68,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <FolderOpen size={19} color="rgba(5,10,68,0.32)" strokeWidth={1.5} />
          </div>
          <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.62)' }}>
            No documents yet
          </p>
          <p style={{
            margin: 0, maxWidth: '400px',
            fontSize: '13px', fontFamily: 'Inter, sans-serif',
            color: 'rgba(5,10,68,0.45)', lineHeight: '1.6',
          }}>
            Once document upload is enabled for your organisation, the files you add
            will be listed here with their indexing status.
          </p>
        </div>
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
