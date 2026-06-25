import { CritiqueTab } from './CritiqueTab'
import { DebateTab } from './DebateTab'
import { useState } from 'react'

type SubTab = 'critique' | 'debate'

const SUB_TABS: { id: SubTab; label: string; desc: string }[] = [
  { id: 'critique', label: '멀티 에이전트 크리틱', desc: 'Summarizer A → Critic → Summarizer B' },
  { id: 'debate',   label: '에이전트 토론',         desc: '간결 vs 포괄 → Judge 판결' },
]

export function AgentLabTab() {
  const [active, setActive] = useState<SubTab>('critique')

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: active === t.id ? 'var(--accent)' : 'var(--surface)',
              color: active === t.id ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: active === t.id ? 600 : 400 }}>{t.label}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {active === 'critique' && <CritiqueTab />}
      {active === 'debate'   && <DebateTab />}
    </div>
  )
}
