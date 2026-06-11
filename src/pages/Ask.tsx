import { useState } from 'react'
import { Sparkles, Filter, Mic, Send } from 'lucide-react'
import { useApp } from '../context/AppContext'

// ── 4 categories, 3 questions each ────────────────────────────────────────────
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

// ── Individual question card — Figma 1575-40289 ───────────────────────────────
function QuestionCard({ question, category, onOpen, index }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#FFFFFF',
        border: '1px solid rgba(42,118,244,0.15)',
        borderRadius: '12px',
        padding: '14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        transition: 'box-shadow 200ms ease',
        boxShadow: hovered
          ? '0px 0px 12px 2px rgba(194,219,255,0.80), 0px 0px 40px 4px rgba(194,219,255,0.48)'
          : 'none',
      }}
    >
      {/* Top row: icon + "Get Started" */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          width: '30px', height: '30px', borderRadius: '8px',
          background: 'rgba(42,118,244,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Sparkles size={14} color="#2A76F4" strokeWidth={1.5} />
        </div>
        <span style={{ fontSize: '11px', fontFamily: 'Satoshi, sans-serif', color: 'rgba(5,10,68,0.45)' }}>
          Get Started
        </span>
      </div>

      {/* Question text */}
      <p style={{
        margin: 0, flex: 1,
        fontSize: '14px', fontFamily: 'Satoshi, sans-serif',
        fontWeight: 400, color: '#10224A', lineHeight: '1.45',
      }}>
        {question}
      </p>

      {/* Separator — matches project standard */}
      <div style={{ height: '1px', background: 'rgba(5,10,68,0.06)' }} />

      {/* Footer: category tag + Try Prompt */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '11px', fontFamily: 'Inter, sans-serif', color: 'rgba(5,10,68,0.50)' }}>
          {category}
        </span>
        <button
          type="button"
          onClick={() => onOpen(`ask-q-${category.toLowerCase().replace(/\s+/g, '-')}-${index}`)}
          style={{
            padding: '3px 8px',
            background: '#2A76F4', border: 'none', borderRadius: '6px',
            fontSize: '11px', fontFamily: 'Satoshi, sans-serif',
            color: '#FFFFFF', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Try Prompt
        </button>
      </div>
    </div>
  )
}

// ── Chat input — Figma 1697-43844 ─────────────────────────────────────────────
function ChatInput({ onOpen }) {
  return (
    <div
      onClick={() => onOpen('ask-page-input')}
      style={{
        background: '#FFFFFF',
        border: '0.8px solid #2A76F4',
        borderRadius: '16px',
        padding: '12px 18px',
        cursor: 'text',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: '0px 0px 36px rgba(42,118,244,0.20), 0px 0px 4px rgba(42,118,244,0.35)',
      }}
    >
      {/* Row 1: placeholder text */}
      <div style={{ padding: '6px 0' }}>
        <p style={{ margin: 0, fontSize: '14px', fontFamily: 'Satoshi, sans-serif', color: '#7F7F7F', lineHeight: '21px' }}>
          Start interacting by typing or speaking here...
        </p>
      </div>

      {/* Row 2: source controls + action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '32px' }}>
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '6px 4px', background: 'none', border: 'none', cursor: 'pointer',
          }}>
            <Filter size={15} color="#2A76F4" />
            <span style={{ fontSize: '14px', fontFamily: 'Satoshi, sans-serif', color: '#2A76F4', lineHeight: '21px' }}>
              Select source
            </span>
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'rgba(42,118,244,0.15)', borderRadius: '4px', padding: '4px 8px',
          }}>
            <Sparkles size={12} color="#2A76F4" strokeWidth={1.5} />
            <span style={{ fontSize: '14px', fontFamily: 'Satoshi, sans-serif', color: '#2A76F4', lineHeight: '21px' }}>
              Ariya Signals
            </span>
          </div>
        </div>
        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button type="button" style={{
            width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: 'none', cursor: 'pointer', borderRadius: '4px',
          }}>
            <Mic size={15} color="rgba(5,10,68,0.45)" />
          </button>
          <button type="button" style={{
            width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: '#2A76F4', border: 'none', cursor: 'pointer', borderRadius: '6px',
          }}>
            <Send size={12} color="#FFFFFF" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Ask() {
  const { openAskModal } = useApp()

  return (
    <div style={{ padding: '20px 36px 36px' }}>

      {/* Description */}
      <p style={{ margin: '0 0 24px', fontSize: '14px', fontFamily: 'Inter, sans-serif', color: '#434c5b', lineHeight: '1.5' }}>
        Ask anything about your competitive landscape — illustrative in this prototype.
      </p>

      {/* Chat input */}
      <ChatInput onOpen={openAskModal} />

      {/* Section separator */}
      <div style={{ height: '1px', background: 'rgba(5,10,68,0.06)', margin: '32px 0' }} />

      {/* Section label */}
      <p style={{ margin: '0 0 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.40)' }}>
        Example questions
      </p>

      {/* 4 categories × 3 question cards each */}
      <div style={{ background: '#F4F8FE', borderRadius: '20px', padding: '24px' }}>
        {QUESTION_CATEGORIES.map((cat, catIdx) => (
          <div key={cat.category}>
            {/* Separator between categories */}
            {catIdx > 0 && (
              <div style={{ height: '1px', background: 'rgba(5,10,68,0.06)', margin: '20px 0' }} />
            )}
            {/* Category label */}
            <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(5,10,68,0.40)' }}>
              {cat.category}
            </p>
            {/* 3 question cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {cat.questions.map((q, qi) => (
                <QuestionCard
                  key={qi}
                  question={q}
                  category={cat.category}
                  onOpen={openAskModal}
                  index={qi}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Section separator */}
      <div style={{ height: '1px', background: 'rgba(5,10,68,0.06)', margin: '32px 0' }} />

      {/* Footer note */}
      <div style={{
        padding: '14px 18px',
        background: 'rgba(42,118,244,0.08)',
        border: '1px solid rgba(210,226,255,1)',
        borderRadius: '12px',
        display: 'flex', alignItems: 'flex-start', gap: '10px',
      }}>
        <Sparkles size={14} color="#2A76F4" strokeWidth={1.5} style={{ marginTop: '2px', flexShrink: 0 }} />
        <p style={{ margin: 0, fontSize: '13px', fontFamily: 'Inter, sans-serif', color: '#434c5b', lineHeight: '1.55' }}>
          <strong style={{ fontWeight: 600, color: '#2A76F4' }}>AI summary (illustrative).</strong>
          {' '}Answers are grounded in your curated CI data and analyst-reviewed sources.
          All content shown here is illustrative.
        </p>
      </div>

    </div>
  )
}
