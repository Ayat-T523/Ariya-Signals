/**
 * MessagingTabV1.tsx — restored Competitors Messaging tab for a REAL tracked
 * V1 company (2026-08-25, "RESTORE COMPETITORS PAGES" checkpoint, report
 * section 16). The historical reference's "Current positioning"/timeline/
 * comparison-table structure requires a messaging-intelligence pipeline V1
 * does not yet have. Section 16 explicitly forbids reclassifying every
 * Company Disclosure Signal as "messaging" or inventing illustrative quotes
 * -- so this tab keeps the restored visual TAB (it still exists, matching
 * the reference), but renders the one honest state the checkpoint itself
 * specifies rather than fabricated positioning content.
 */
import { AlertTriangle } from 'lucide-react'

export default function MessagingTabV1({ companyName }: { companyName: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '16px 18px', borderRadius: 'var(--r-md)',
      background: 'var(--cream-100)', border: '1px solid var(--indigo-100)',
    }}>
      <AlertTriangle size={16} style={{ flexShrink: 0, color: 'var(--ink-600)', marginTop: 2 }} />
      <div>
        <p style={{ margin: '0 0 4px', fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 600, color: 'var(--ink-800)' }}>
          Messaging intelligence not yet available
        </p>
        <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--ink-600)', lineHeight: 1.55 }}>
          No source-backed messaging intelligence is available yet for {companyName}.
        </p>
      </div>
    </div>
  )
}
