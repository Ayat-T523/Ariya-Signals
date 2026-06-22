export default function MarketPerformance() {
  return (
    <div style={{ padding: '28px 32px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '8px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          Market Performance — Ekterly vs HAE class
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
          Sources: IQVIA DE/UK/US · Veeva CRM · Movianto logistics · GlobalData Drug Sales
        </p>
      </div>

      {/* Illustrative-data label */}
      <div style={{
        display: 'inline-block', marginTop: '14px', marginBottom: '20px',
        padding: '4px 10px', borderRadius: '9999px',
        background: 'rgba(245,158,11,0.10)', color: '#92500A',
        fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em',
      }}>
        Illustrative data
      </div>

      {/* Power BI embed placeholder */}
      <div
        role="region"
        aria-label="Power BI embed placeholder"
        style={{
          minHeight: '400px',
          background: '#E8EAF6',
          border: '1.5px dashed rgba(5,10,68,0.18)',
          borderRadius: '20px',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '14px',
          textAlign: 'center',
        }}
      >
        {/* Power BI wordmark — yellow square + label */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '10px',
          padding: '6px 14px', borderRadius: '8px',
          background: '#FFFFFF',
          border: '1px solid rgba(5,10,68,0.08)',
          boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
        }}>
          {/* Stylised Power BI mark — three vertical bars */}
          <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
            <rect x="2"  y="6"  width="4" height="14" rx="1" fill="#F2C811" />
            <rect x="9"  y="2"  width="4" height="18" rx="1" fill="#E6A609" />
            <rect x="16" y="9"  width="4" height="11" rx="1" fill="#C68A07" />
          </svg>
          <span style={{
            fontSize: '13px', fontWeight: 700,
            color: 'rgba(5,10,68,0.78)', letterSpacing: '-0.01em',
          }}>
            Power BI
          </span>
        </div>

        {/* Heading */}
        <h2 style={{
          margin: '8px 0 0', fontSize: '18px', fontWeight: 700,
          color: 'rgba(5,10,68,0.85)',
        }}>
          Embedded Power BI report
        </h2>

        {/* Body */}
        <p style={{
          margin: 0, maxWidth: '560px',
          fontSize: '13px', color: 'rgba(5,10,68,0.60)',
          lineHeight: '1.6',
        }}>
          Live market performance data will appear here via Power BI embed,
          aligned with the Azure data pipeline. Configuration in progress with
          the data engineering team.
        </p>

        {/* Contact caption */}
        <p style={{
          margin: '8px 0 0',
          fontSize: '12px', fontStyle: 'italic',
          color: 'rgba(5,10,68,0.45)',
        }}>
          Contact: Ananda Ramachandra · data pipeline lead
        </p>
      </div>
    </div>
  )
}
