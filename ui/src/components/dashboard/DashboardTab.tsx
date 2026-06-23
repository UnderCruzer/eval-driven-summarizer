import { useState } from 'react'
import { VersionTab } from './VersionTab'
import { FailureTab } from './FailureTab'
import { TraceTab } from './TraceTab'

type Sub = 'versions' | 'failures' | 'traces'
const SUBS: { id: Sub; label: string }[] = [
  { id: 'versions', label: '📈 버전 비교' },
  { id: 'failures', label: '🔍 실패 케이스' },
  { id: 'traces',   label: '🧵 트레이스' },
]

export function DashboardTab() {
  const [sub, setSub] = useState<Sub>('versions')
  return (
    <div>
      <div className="dashboard-subnav">
        {SUBS.map((s) => (
          <button
            key={s.id}
            className={`dashboard-subbtn${sub === s.id ? ' dashboard-subbtn-active' : ''}`}
            onClick={() => setSub(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'versions' && <VersionTab />}
      {sub === 'failures' && <FailureTab />}
      {sub === 'traces'   && <TraceTab />}
    </div>
  )
}
