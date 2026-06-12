export default function MarketPerformance() {
  return (
    <div style={{ padding: '20px 36px 36px' }}>

      {/* ── Page description ─────────────────────────────────────────────────── */}
      <p style={{
        margin: '0 0 28px',
        fontSize: '14px', fontFamily: 'Inter, sans-serif',
        color: '#434c5b', lineHeight: '1.5',
      }}>
        Ekterly vs HAE class · Sources: IQVIA DE/UK/US · Veeva CRM · Movianto logistics
      </p>

      {/* ── Section label ────────────────────────────────────────────────────── */}
      <p style={{
        margin: '0 0 12px',
        fontSize: '11px', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.10em',
        color: 'rgba(5,10,68,0.40)',
      }}>
        Market data
      </p>

      {/* ── Power BI embed placeholder ───────────────────────────────────────── */}
      <div
        role="region"
        aria-label="Power BI embed placeholder"
        style={{
          minHeight: '480px',
          background: 'rgba(42,118,244,0.04)',
          border: '1px solid rgba(210,226,255,1)',
          borderRadius: '12px',
          padding: '48px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          textAlign: 'center',
        }}
      >
        {/* Power BI wordmark */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          padding: '8px 16px', borderRadius: '8px',
          background: '#FFFFFF',
          border: '1px solid rgba(210,226,255,1)',
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="2"  y="6"  width="4" height="14" rx="1" fill="#F2C811" />
            <rect x="9"  y="2"  width="4" height="18" rx="1" fill="#E6A609" />
            <rect x="16" y="9"  width="4" height="11" rx="1" fill="#C68A07" />
          </svg>
          <span style={{
            fontSize: '13px', fontWeight: 600,
            fontFamily: 'Satoshi, sans-serif',
            color: '#434c5b', letterSpacing: '-0.01em',
          }}>
            Power BI
          </span>
        </div>

        {/* Heading */}
        <h2 style={{
          margin: '4px 0 0',
          fontSize: '16px', fontWeight: 600,
          fontFamily: 'Satoshi, sans-serif',
          color: '#434c5b',
        }}>
          Embedded Power BI report
        </h2>

        {/* Body */}
        <p style={{
          margin: 0, maxWidth: '520px',
          fontSize: '14px', fontFamily: 'Inter, sans-serif',
          color: '#434c5b', lineHeight: '1.65',
        }}>
          Live market performance data will appear here via Power BI embed,
          aligned with the Azure data pipeline. Configuration in progress with
          the data engineering team.
        </p>

        {/* Contact */}
        <p style={{
          margin: '4px 0 0',
          fontSize: '13px', fontStyle: 'italic',
          fontFamily: 'Inter, sans-serif',
          color: 'rgba(5,10,68,0.55)',
        }}>
          Contact: Ananda Ramachandra · data pipeline lead
        </p>
      </div>

    </div>
  )
}
