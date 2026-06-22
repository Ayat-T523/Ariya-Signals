import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const ROLES = [
  { id: 'commercial', label: 'Commercial / Brand',         description: 'Brand positioning, share-of-voice, competitive launch dynamics' },
  { id: 'access',     label: 'Market Access',              description: 'HTA decisions, payer dynamics, pricing and reimbursement' },
  { id: 'bd',         label: 'BD / Corporate Strategy',    description: 'Deal landscape, pipeline competition, partnership signals' },
  { id: 'executive',  label: 'Executive / Leadership',     description: 'Franchise-wide view, weekly digests, headline signals' },
]

export default function OnboardingModal() {
  const { userRole, setUserRole, completeOnboarding, closeOnboarding, startTour } = useApp()
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState(userRole || null)

  function handleStartTour() {
    if (!selectedRole) return
    setUserRole(selectedRole)
    startTour() // navigates to '/', does NOT mark onboarding complete
  }

  function handleSkip() {
    if (selectedRole) setUserRole(selectedRole)
    completeOnboarding([])
    closeOnboarding()
    navigate('/')
  }

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(5,10,68,0.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: '20px',
        width: '100%', maxWidth: '560px',
        maxHeight: '90vh', overflowY: 'auto',
        padding: '40px',
        boxShadow: '0 24px 80px rgba(5,10,68,0.22)',
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700, color: 'rgba(5,10,68,0.92)', lineHeight: 1.25 }}>
          Welcome to Ariya. What is your role?
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'rgba(5,10,68,0.55)', lineHeight: '1.55' }}>
          We'll tailor your War Room and summaries to match.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
          {ROLES.map((role) => {
            const isSelected = selectedRole === role.id
            return (
              <div
                key={role.id}
                onClick={() => setSelectedRole(role.id)}
                style={{
                  border: isSelected ? '2px solid #050A44' : '1.5px solid rgba(5,10,68,0.12)',
                  borderRadius: '12px',
                  padding: '14px 16px',
                  background: isSelected ? 'rgba(5,10,68,0.03)' : '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'border-color 150ms ease, background 150ms ease',
                }}
              >
                <p style={{ margin: '0 0 4px', fontSize: '15px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
                  {role.label}
                </p>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.55)' }}>
                  {role.description}
                </p>
              </div>
            )
          })}
        </div>

        <button
          onClick={handleStartTour}
          disabled={!selectedRole}
          style={{
            width: '100%', background: selectedRole ? '#050A44' : 'rgba(5,10,68,0.20)',
            color: '#FFFFFF', border: 'none', borderRadius: '10px',
            padding: '14px', fontSize: '15px', fontWeight: 600,
            cursor: selectedRole ? 'pointer' : 'not-allowed',
            letterSpacing: '-0.01em', marginBottom: '12px',
            fontFamily: 'inherit',
            transition: 'background 150ms ease',
          }}
        >
          {selectedRole ? 'Start tour →' : 'Select a role to continue'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px',
              fontSize: '13px', color: 'rgba(5,10,68,0.50)', fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Skip and go straight to my War Room
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
