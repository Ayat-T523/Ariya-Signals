import { Info } from 'lucide-react'
import { useState } from 'react'

const TRACKED_ASSETS = [
  {
    inn: 'lanadelumab',
    brandName: 'Takhzyro',
    company: 'Takeda',
    therapeuticArea: 'HAE / Hereditary Angioedema',
    mechanismClass: 'Plasma kallikrein inhibitor (monoclonal antibody)',
    indication: 'HAE type I & II — long-term prophylaxis',
    synonyms: ['lanadelumab', 'Takhzyro', 'SHP643', 'HAE prophylaxis', 'kallikrein inhibitor', 'bradykinin', 'C1-INH deficiency', 'hereditary angioedema', 'HELP trial'],
    competitorPosture: 'Incumbent to displace',
  },
  {
    inn: 'berotralstat',
    brandName: 'Orladeyo',
    company: 'BioCryst',
    therapeuticArea: 'HAE / Hereditary Angioedema',
    mechanismClass: 'Plasma kallikrein inhibitor (small molecule, oral)',
    indication: 'HAE type I & II — long-term prophylaxis',
    synonyms: ['berotralstat', 'Orladeyo', 'BCX7353', 'oral prophylaxis', 'kallikrein inhibitor', 'bradykinin', 'C1-INH deficiency', 'hereditary angioedema', 'APeX trials'],
    competitorPosture: 'Adjacent oral competitor',
  },
  {
    inn: 'deucrictibant',
    brandName: null,
    company: 'Pharvaris',
    therapeuticArea: 'HAE / Hereditary Angioedema',
    mechanismClass: 'Bradykinin B2 receptor antagonist (small molecule, oral)',
    indication: 'HAE type I & II — on-demand and prophylaxis',
    synonyms: ['deucrictibant', 'PHVS416', 'PHA121', 'bradykinin B2 receptor', 'B2 antagonist', 'oral on-demand', 'hereditary angioedema', 'OASE trials'],
    competitorPosture: 'Emerging direct threat',
  },
]

const POSTURE_STYLE = {
  'Incumbent to displace':    { bg: 'rgba(5,10,68,0.08)',    text: 'rgba(5,10,68,0.70)' },
  'Adjacent oral competitor': { bg: 'rgba(0,85,187,0.10)',   text: '#0055BB'             },
  'Emerging direct threat':   { bg: 'rgba(225,29,72,0.10)',  text: '#C01041'             },
}

const MAX_VISIBLE_TAGS = 5

function SynonymCell({ synonyms }) {
  const visible = synonyms.slice(0, MAX_VISIBLE_TAGS)
  const overflow = synonyms.length - MAX_VISIBLE_TAGS
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
      {visible.map(s => (
        <span key={s} style={{
          display: 'inline-block', padding: '2px 7px', borderRadius: '9999px',
          fontSize: '11px', background: 'rgba(5,10,68,0.07)', color: 'rgba(5,10,68,0.55)',
          fontWeight: 500, whiteSpace: 'nowrap',
        }}>
          {s}
        </span>
      ))}
      {overflow > 0 && (
        <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.35)', whiteSpace: 'nowrap' }}>
          +{overflow} more
        </span>
      )}
    </div>
  )
}

function PostureBadge({ posture }) {
  const cfg = POSTURE_STYLE[posture] || { bg: '#E8EAF6', text: 'rgba(5,10,68,0.65)' }
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: '9999px',
      fontSize: '11px', fontWeight: 700,
      background: cfg.bg, color: cfg.text, whiteSpace: 'nowrap',
    }}>
      {posture}
    </span>
  )
}

function Tooltip({ text }) {
  const [visible, setVisible] = useState(false)
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <Info
        size={13}
        color="rgba(5,10,68,0.35)"
        strokeWidth={1.8}
        style={{ cursor: 'pointer' }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      />
      {visible && (
        <div style={{
          position: 'absolute', left: '20px', top: '-4px', zIndex: 50,
          background: 'rgba(5,10,68,0.92)', color: '#FFFFFF',
          borderRadius: '8px', padding: '8px 12px',
          fontSize: '12px', lineHeight: '1.55',
          width: '280px', boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {text}
        </div>
      )}
    </span>
  )
}

const TH = ({ children, width }) => (
  <th style={{
    padding: '10px 14px', textAlign: 'left',
    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'rgba(5,10,68,0.45)',
    borderBottom: '1.5px solid rgba(5,10,68,0.08)',
    background: '#FAFBFD',
    width,
  }}>
    {children}
  </th>
)

const TD = ({ children, style }) => (
  <td style={{
    padding: '14px', fontSize: '13px', color: 'rgba(5,10,68,0.75)',
    borderBottom: '1px solid rgba(5,10,68,0.06)',
    verticalAlign: 'top',
    lineHeight: '1.5',
    ...style,
  }}>
    {children}
  </td>
)

export default function AdminPage() {
  function resetOnboarding() {
    localStorage.removeItem('onboardingComplete')
    localStorage.removeItem('trackedAssets')
    window.location.reload()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1200px' }}>

      {/* Page header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
          Admin — CI War Room configuration
        </h1>
        <p style={{ margin: 0, fontSize: '13px', color: 'rgba(5,10,68,0.45)' }}>
          Prototype configuration panel. In production, this is managed by Phamax at onboarding.
        </p>
      </div>

      {/* Section 1: Tracked assets */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 4px 12px rgba(5,10,68,0.04)',
        marginBottom: '24px',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(5,10,68,0.07)',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>
            Tracked assets
          </h2>
          <Tooltip text="These keywords are automatically applied to all monitoring sources. When an alert matches any synonym for a tracked asset, it is attributed to that asset." />
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr>
                <TH width="90px">Asset (INN)</TH>
                <TH width="90px">Brand name</TH>
                <TH width="80px">Company</TH>
                <TH width="130px">Therapeutic area</TH>
                <TH width="160px">Mechanism class</TH>
                <TH width="160px">Indication</TH>
                <TH>Key synonyms monitored</TH>
                <TH width="150px">Competitor posture</TH>
              </tr>
            </thead>
            <tbody>
              {TRACKED_ASSETS.map(asset => (
                <tr key={asset.inn} style={{ background: '#FFFFFF' }}>
                  <TD style={{ fontWeight: 600, color: 'rgba(5,10,68,0.88)' }}>{asset.inn}</TD>
                  <TD style={{ fontStyle: asset.brandName ? 'normal' : 'italic', color: asset.brandName ? 'rgba(5,10,68,0.75)' : 'rgba(5,10,68,0.40)' }}>
                    {asset.brandName ?? '— (in development)'}
                  </TD>
                  <TD>{asset.company}</TD>
                  <TD>{asset.therapeuticArea}</TD>
                  <TD>{asset.mechanismClass}</TD>
                  <TD>{asset.indication}</TD>
                  <TD><SynonymCell synonyms={asset.synonyms} /></TD>
                  <TD><PostureBadge posture={asset.competitorPosture} /></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Reset state */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '16px',
        border: '1px solid rgba(5,10,68,0.08)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04), 0 4px 12px rgba(5,10,68,0.04)',
        padding: '24px',
      }}>
        <h2 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'rgba(5,10,68,0.88)' }}>
          Reset onboarding state
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'rgba(5,10,68,0.50)', lineHeight: '1.6' }}>
          To replay the onboarding + guided tour as a new user, use the "Take the tour" button in the sidebar.
          This action below fully clears local state and reloads — only use it to fully reset the demo.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={resetOnboarding}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              fontSize: '12px', color: 'rgba(5,10,68,0.40)', fontFamily: 'inherit',
              textDecoration: 'underline',
            }}
          >
            Reset onboarding state
          </button>
          <span style={{ fontSize: '11px', color: 'rgba(5,10,68,0.30)' }}>
            — Clears localStorage and reloads. Next visit will trigger onboarding automatically.
          </span>
        </div>
      </div>

    </div>
  )
}
