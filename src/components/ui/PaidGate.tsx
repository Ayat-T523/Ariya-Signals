import { Lock } from 'lucide-react'

interface PaidGateProps {
  label: string
  description?: string
}

export default function PaidGate({ label, description = 'Available in the full platform · Contact your account team' }: PaidGateProps) {
  return (
    <div style={{
      borderRadius: '12px',
      border: '1px dashed rgba(5,10,68,0.18)',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      background: 'rgba(5,10,68,0.02)',
    }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px',
        background: 'rgba(5,10,68,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Lock size={15} color="rgba(5,10,68,0.40)" strokeWidth={2} />
      </div>
      <div>
        <p style={{ margin: '0 0 2px', fontSize: '14px', fontWeight: 600, color: 'rgba(5,10,68,0.55)', fontFamily: 'Satoshi, sans-serif' }}>
          {label}
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.38)', fontFamily: 'Inter, sans-serif' }}>
          {description}
        </p>
      </div>
    </div>
  )
}
