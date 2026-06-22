import { useEffect, useState } from 'react'
import { fetchRunIds, fetchTraces } from '../../api/client'
import type { TraceRow } from '../../types'

const STAGE_COLOR: Record<string, string> = {
  summarize: '#60a5fa',
  judge:     'var(--yellow)',
  analyze:   '#a78bfa',
  improve:   'var(--green)',
}

export function TraceTab() {
  const [runIds, setRunIds] = useState<string[]>([])
  const [selectedRun, setSelectedRun] = useState('')
  const [selectedDoc, setSelectedDoc] = useState('')
  const [traces, setTraces] = useState<TraceRow[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchRunIds().then((d) => {
      setRunIds(d.run_ids)
      if (d.run_ids.length) setSelectedRun(d.run_ids[0])
    })
  }, [])

  useEffect(() => {
    if (!selectedRun) return
    fetchTraces(selectedRun, selectedDoc).then((d) => {
      setTraces(d.traces)
      setExpanded(new Set())
    })
  }, [selectedRun, selectedDoc])

  const docIds = [...new Set(traces.map((t) => t.doc_id))].sort()

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (!runIds.length) {
    return <p className="dash-empty">트레이스 데이터가 없습니다.</p>
  }

  return (
    <div className="dash-section">
      <div className="failure-filters">
        <div>
          <label>Run ID</label>
          <select value={selectedRun} onChange={(e) => { setSelectedRun(e.target.value); setSelectedDoc('') }}>
            {runIds.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label>문서</label>
          <select value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)}>
            <option value="">전체</option>
            {docIds.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {traces.map((t) => {
        const open = expanded.has(t.id)
        const color = STAGE_COLOR[t.stage] ?? 'var(--text-muted)'
        return (
          <div className="failure-card" key={t.id}>
            <button className="failure-header" onClick={() => toggleExpand(t.id)}>
              <span style={{ color }}>●</span>
              <span className="failure-doc" style={{ color }}>{t.stage.toUpperCase()}</span>
              <span className="failure-doc">{t.doc_id}</span>
              <span className="failure-score">{t.elapsed_ms.toFixed(1)}ms</span>
              <span style={{ color: t.error ? 'var(--red)' : 'var(--green)' }}>
                {t.error ? '✕' : '✓'}
              </span>
              <span className="failure-chevron">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
              <div className="failure-body">
                <div className="trace-grid">
                  <div>
                    <p className="failure-label">Input</p>
                    <pre className="trace-json">{JSON.stringify(t.input_data, null, 2)}</pre>
                  </div>
                  <div>
                    <p className="failure-label">Output</p>
                    <pre className="trace-json">{JSON.stringify(t.output_data, null, 2)}</pre>
                  </div>
                </div>
                {t.error && <div className="trace-error">{t.error}</div>}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
