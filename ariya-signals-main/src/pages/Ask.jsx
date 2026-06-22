import { Sparkles, Search } from 'lucide-react'
import { useApp } from '../context/AppContext'

// ── Example questions by category ─────────────────────────────────────────────
const QUESTION_CATEGORIES = [
  {
    category: 'Competitive landscape',
    questions: [
      'How does Pharvaris deucrictibant compare to sebetralstat on mechanism?',
      'Which competitor is most active in Europe this quarter?',
      'What are Takeda\'s key defensive moves against oral entrants?',
    ],
  },
  {
    category: 'Pipeline & trials',
    questions: [
      'Summarize the RAPIDe-3 trial design and key endpoints.',
      'What does the Pharvaris Phase III interim timeline mean for us?',
      'How does the BioCryst extended-release program affect our positioning?',
    ],
  },
  {
    category: 'Strategy & planning',
    questions: [
      'What should we prepare for ahead of the RAPIDe-3 readout?',
      'Which market access signals should Pharma Inc act on now?',
      'How should we frame sebetralstat vs. deucrictibant for KOLs?',
    ],
  },
  {
    category: 'Signals & intelligence',
    questions: [
      'Summarize this week\'s signals across all competitors.',
      'What do recent Pharvaris hiring signals suggest about launch timing?',
      'Which earnings calls this quarter contain HAE-relevant commentary?',
    ],
  },
]

// ── Question chip ─────────────────────────────────────────────────────────────
function QuestionChip({ question, source }) {
  const { openAskModal } = useApp()
  return (
    <button
      onClick={() => openAskModal(source)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: '8px',
        width: '100%', textAlign: 'left',
        padding: '13px 16px',
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid rgba(5,10,68,0.09)',
        boxShadow: '0 1px 2px rgba(5,10,68,0.04)',
        cursor: 'pointer',
        transition: 'border-color 150ms ease, box-shadow 150ms ease',
      }}
      className="hover-lift"
    >
      <Sparkles size={14} color="#0055BB" style={{ marginTop: '2px', flexShrink: 0 }} />
      <span style={{ fontSize: '13px', color: 'rgba(5,10,68,0.78)', lineHeight: '1.50', fontWeight: 500 }}>
        {question}
      </span>
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Ask() {
  const { openAskModal } = useApp()

  return (
    <div style={{ padding: '28px 32px', maxWidth: '900px' }}>

      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #0055BB 0%, #1A6BFF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={18} color="#FFFFFF" />
          </div>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'rgba(5,10,68,0.92)' }}>
            Ask Ariya
          </h1>
        </div>
        <p style={{ margin: 0, fontSize: '14px', color: 'rgba(5,10,68,0.50)' }}>
          Ask anything about your competitive landscape — illustrative in this prototype.
        </p>
      </div>

      {/* Non-functional ask input */}
      <div
        onClick={() => openAskModal('ask-page-input')}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 18px',
          background: '#FFFFFF',
          borderRadius: '16px',
          border: '1.5px solid rgba(5,10,68,0.14)',
          boxShadow: '0 2px 8px rgba(5,10,68,0.06)',
          marginBottom: '36px',
          cursor: 'text',
        }}
      >
        <Search size={16} color="rgba(5,10,68,0.35)" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '14px', color: 'rgba(5,10,68,0.35)', flex: 1 }}>
          Ask about competitors, pipeline, signals, strategy…
        </span>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 10px', borderRadius: '9999px',
          background: 'linear-gradient(135deg, #0055BB 0%, #1A6BFF 100%)',
        }}>
          <Sparkles size={12} color="#fff" />
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>Ask</span>
        </div>
      </div>

      {/* Question categories grid */}
      <div>
        <p style={{
          margin: '0 0 20px', fontSize: '11px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.10em',
          color: 'rgba(5,10,68,0.38)',
        }}>
          Example questions
        </p>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '28px',
        }}>
          {QUESTION_CATEGORIES.map(({ category, questions }) => (
            <div key={category}>
              {/* Category label */}
              <p style={{
                margin: '0 0 10px',
                fontSize: '12px', fontWeight: 700,
                color: 'rgba(5,10,68,0.55)',
                letterSpacing: '0.01em',
              }}>
                {category}
              </p>
              {/* Question chips */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {questions.map((q, i) => (
                  <QuestionChip
                    key={i}
                    question={q}
                    source={`ask-page-${category.toLowerCase().replace(/\s+/g, '-')}-q${i}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div style={{
        marginTop: '40px', padding: '14px 18px',
        background: '#E8EAF6', borderRadius: '12px',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <Sparkles size={13} color="#0055BB" />
        <p style={{ margin: 0, fontSize: '12px', color: 'rgba(5,10,68,0.60)', lineHeight: '1.55' }}>
          <strong style={{ fontWeight: 700, color: '#0055BB' }}>AI — prototype placeholder.</strong>
          {' '}In the live product, answers are grounded in your curated CI data and analyst-reviewed sources.
          All content shown here is illustrative only.
        </p>
      </div>

    </div>
  )
}
