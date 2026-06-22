import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Bell, Sparkles, HelpCircle, X } from 'lucide-react'
import { useApp, useConfig } from '../../context/AppContext'
import user from '../../data/user.json'
import { DEMO } from '../../config/demo-config'

function buildHeaderHelpSections(assetName: string, indication: string) {
  return [
    { name: 'War Room',            description: 'Your personalised landing page with the signals that matter most to you this week.' },
    { name: 'Competitors',         description: 'Pipeline, company, and messaging profiles for all 8 tracked competitors.' },
    { name: 'Market Performance',  description: `${assetName} uptake vs the ${indication} class across DE, UK, and US.` },
    { name: 'Intelligence Feed',   description: 'Events calendar, earnings digests, deal landscape, and HTA tracker.' },
    { name: 'Pricing and Access',  description: 'Multi-region pricing benchmark across 7 markets.' },
    { name: 'Alerts',              description: 'Full signal feed, filterable by type and competitor.' },
    { name: 'My Space',            description: 'Configure your delivery preferences and personal uploads.' },
  ]
}

function HelpModal({ onClose, onTakeTour }) {
  const { assetName, indication } = useConfig()
  const HELP_SECTIONS = buildHeaderHelpSections(assetName, indication)
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(5,10,68,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#FFFFFF', borderRadius: '20px',
          width: '100%', maxWidth: '600px',
          maxHeight: '85vh', overflowY: 'auto',
          padding: '36px 40px',
          boxShadow: '0 24px 80px rgba(5,10,68,0.22)',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close help"
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px', borderRadius: '8px',
            color: 'rgba(5,10,68,0.45)',
          }}
        >
          <X size={18} />
        </button>

        <h2 style={{ margin: '0 0 10px', fontSize: '22px', fontWeight: 700, color: 'rgba(5,10,68,0.92)', lineHeight: 1.25 }}>
          What is Ariya Signals?
        </h2>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'rgba(5,10,68,0.62)', lineHeight: '1.65' }}>
          A competitive intelligence hub for {DEMO.companyLabel}'s {indication} franchise. It monitors {assetName}'s competitive
          environment, tracks competitor pipeline and commercial moves, and delivers role-tailored insights
          so you spend less time gathering and more time deciding.
        </p>

        <p style={{ margin: '0 0 10px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.40)' }}>
          Sections
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {HELP_SECTIONS.map((s) => (
            <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>
                {s.name}
              </p>
              <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.58)', lineHeight: '1.55' }}>
                {s.description}
              </p>
            </div>
          ))}
        </div>

        {/* Take the tour CTA */}
        <div style={{
          marginTop: '24px', paddingTop: '20px',
          borderTop: '1px solid rgba(5,10,68,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
        }}>
          <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.62)', lineHeight: '1.5' }}>
            New here, or want a quick refresher? Take the guided tour.
          </p>
          <button
            onClick={onTakeTour}
            style={{
              padding: '8px 16px', borderRadius: '9999px',
              background: '#050A44', color: '#FFFFFF',
              border: 'none', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
            }}
          >
            Take the tour →
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default function Header() {
  const { unreadCount, openAskModal, startTour } = useApp()
  const navigate = useNavigate()
  const [helpOpen, setHelpOpen] = useState(false)

  function handleTakeTour() {
    setHelpOpen(false)
    startTour()
  }

  return (
    <div>
      {/* ── Main header bar ─────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-end px-6"
        style={{
          height: '60px',
          background: '#FFFFFF',
          borderBottom: '1px solid rgba(5,10,68,0.08)',
        }}
      >
        <div className="flex items-center gap-3">

          {/* Help (?) button — Task 6c */}
          <button
            onClick={() => setHelpOpen(true)}
            className="flex items-center justify-center p-2 rounded-lg"
            style={{ color: 'rgba(5,10,68,0.55)', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label="Open help"
            title="What is Ariya Signals?"
          >
            <HelpCircle size={18} />
          </button>

          {/* Bell icon */}
          <button
            onClick={() => navigate('/alerts')}
            className="relative flex items-center justify-center p-2 rounded-lg"
            style={{ color: 'rgba(5,10,68,0.55)', background: 'none', border: 'none', cursor: 'pointer' }}
            aria-label={`${unreadCount} unread alert${unreadCount !== 1 ? 's' : ''}`}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                className="absolute"
                style={{
                  top: '6px',
                  right: '6px',
                  width: '7px',
                  height: '7px',
                  background: '#E11D48',
                  borderRadius: '50%',
                  border: '1.5px solid #fff',
                }}
              />
            )}
          </button>

          {/* Ask button — id="ask-button" is the keyboard shortcut target */}
          <button
            id="ask-button"
            onClick={() => openAskModal('header-ask-button')}
            className="flex items-center gap-1.5 font-semibold"
            style={{
              padding: '7px 16px',
              background: '#050A44',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '9999px',
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'transform 150ms ease, box-shadow 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(5,10,68,0.22)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = ''
            }}
          >
            <Sparkles size={13} />
            Ask
          </button>

          {/* Divider */}
          <div
            style={{ width: '1px', height: '24px', background: 'rgba(5,10,68,0.10)' }}
          />

          {/* User avatar + name */}
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-full font-bold"
              style={{
                width: '32px',
                height: '32px',
                background: '#E8EAF6',
                fontSize: '12px',
                color: '#0055BB',
                flexShrink: 0,
              }}
            >
              {user.user.name.charAt(0)}
            </div>
            <div style={{ lineHeight: 1.3 }}>
              <p
                className="font-semibold m-0"
                style={{ fontSize: '13px', color: 'rgba(5,10,68,0.92)' }}
              >
                {user.user.name}
              </p>
              <p className="m-0" style={{ fontSize: '11px', color: 'rgba(5,10,68,0.45)' }}>
                {user.company}
              </p>
            </div>
          </div>

        </div>
      </header>


{helpOpen && <HelpModal onClose={() => setHelpOpen(false)} onTakeTour={handleTakeTour} />}
    </div>
  )
}
