import { useEffect, useState } from 'react'
import { fetchFailures } from '../../api/client'
import type { FailureCase } from '../../types'

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--green)', B: 'var(--yellow)', C: '#f97316', F: 'var(--red)',
}

export function FailureTab() {
  const [version, setVersion] = useState('')
  const [threshold, setThreshold] = useState(3.0)
  const [results, setResults] = useState<FailureCase[]>([])
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchFailures(version, threshold).then((d) => {
      setResults(d.results)
      setExpanded(new Set())
    })
  }, [version, threshold])

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="dash-section">
      <div className="failure-filters">
        <div>
          <label>버전 필터</label>
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            <option value="">전체</option>
            {['v1', 'v2', 'v3'].map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label>총점 임계값 ≤ {threshold.toFixed(1)}</label>
          <input
            type="range" min={0} max={5} step={0.1}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
        </div>
        <span className="failure-count">{results.length}건</span>
      </div>

      {!results.length && (
        <p className="dash-empty">해당 조건의 실패 케이스가 없습니다.</p>
      )}

      {results.map((r) => {
        const open = expanded.has(r.id)
        const reasoning = typeof r.reasoning === 'object' ? r.reasoning : {}
        return (
          <div className="failure-card" key={r.id}>
            <button className="failure-header" onClick={() => toggleExpand(r.id)}>
              <span style={{ color: GRADE_COLOR[r.grade] }}>●</span>
              <span className="tag tag-current">{r.prompt_version}</span>
              <span className="failure-doc">{r.doc_id}</span>
              <span className="failure-score">총점 {r.total_score}</span>
              <span className="failure-grade" style={{ color: GRADE_COLOR[r.grade] }}>{r.grade}</span>
              <span className="failure-chevron">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
              <div className="failure-body">
                <div className="metric-chips">
                  {[
                    { label: 'Coverage',     val: r.key_point_coverage },
                    { label: 'Faithfulness', val: r.faithfulness },
                    { label: 'Info Loss',    val: r.information_loss },
                    { label: 'Length',       val: r.length_adequacy },
                  ].map((m) => (
                    <div className="score-chip" key={m.label}>
                      {m.label} <span>{m.val}</span>
                    </div>
                  ))}
                </div>
                <p className="failure-label">요약 내용</p>
                <div className="failure-summary">{r.summary}</div>
                <p className="failure-label">평가 근거</p>
                <ul className="failure-reasoning">
                  {Object.entries(reasoning).map(([k, v]) => (
                    <li key={k}><strong>{k}</strong>: {v}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
