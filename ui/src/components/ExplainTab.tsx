import { useState } from 'react'
import { runExplain } from '../api/client'

const VERSIONS = ['v1', 'v2', 'v3']
const DOC_TYPES = ['news', 'paper', 'meeting', 'en_news']

const PALETTE = [
  '#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626',
  '#0891b2', '#7c2d12', '#4f46e5', '#065f46', '#92400e',
]

type Mapping = { sentence: string; source_quotes: string[] }
type Result = { summary: string; mappings: Mapping[] }

export function ExplainTab() {
  const [version, setVersion] = useState('v1')
  const [docType, setDocType] = useState('news')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [activeIdx, setActiveIdx] = useState<number | null>(null)

  async function handleRun() {
    if (!content.trim()) return
    setLoading(true)
    setResult(null)
    setError('')
    setActiveIdx(null)
    try {
      const data = await runExplain({ version, doc_type: docType, content })
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function highlightContent(text: string, mappings: Mapping[], activeIdx: number | null) {
    if (activeIdx === null) return <span>{text}</span>
    const quotes = mappings[activeIdx]?.source_quotes ?? []
    const color = PALETTE[activeIdx % PALETTE.length]
    if (!quotes.length) return <span>{text}</span>

    // 모든 quote를 찾아 하이라이트
    const parts: { text: string; highlight: boolean }[] = []
    let remaining = text

    // 각 quote 위치를 기록
    const spans: { start: number; end: number }[] = []
    for (const q of quotes) {
      let idx = 0
      while (true) {
        const pos = remaining.indexOf(q, idx)
        if (pos === -1) break
        spans.push({ start: pos, end: pos + q.length })
        idx = pos + 1
      }
    }
    spans.sort((a, b) => a.start - b.start)

    let cursor = 0
    for (const span of spans) {
      if (span.start > cursor) parts.push({ text: remaining.slice(cursor, span.start), highlight: false })
      parts.push({ text: remaining.slice(span.start, span.end), highlight: true })
      cursor = span.end
    }
    if (cursor < remaining.length) parts.push({ text: remaining.slice(cursor), highlight: false })

    return (
      <>
        {parts.map((p, i) =>
          p.highlight
            ? <mark key={i} style={{ background: `${color}44`, color, borderRadius: 3, padding: '0 2px' }}>{p.text}</mark>
            : <span key={i}>{p.text}</span>
        )}
      </>
    )
  }

  return (
    <div className="playground">
      <div className="pg-controls">
        <div>
          <label>버전</label>
          <select value={version} onChange={(e) => setVersion(e.target.value)}>
            {VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label>문서 유형</label>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button className="btn-primary" disabled={loading || !content.trim()} onClick={handleRun}>
          {loading ? '분석 중…' : '🔍 출처 분석'}
        </button>
      </div>

      {!result && (
        <div className="pg-input-col" style={{ marginTop: 8 }}>
          <label className="pg-label">원문</label>
          <textarea className="pg-textarea" rows={12} placeholder="문서를 붙여넣으세요…"
            value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
      )}

      {error && <div className="trace-error">{error}</div>}

      {result && (
        <div className="explain-layout">
          {/* 원문 — 하이라이트 */}
          <div className="explain-panel">
            <div className="explain-panel-title">원문</div>
            <div className="explain-source">
              {highlightContent(content, result.mappings, activeIdx)}
            </div>
            <button className="debate-toggle" style={{ marginTop: 10 }}
              onClick={() => { setResult(null); setActiveIdx(null) }}>
              ↩ 다시 입력
            </button>
          </div>

          {/* 요약 문장들 */}
          <div className="explain-panel">
            <div className="explain-panel-title">요약 — 문장을 클릭하면 원문 출처가 강조됩니다</div>
            <div className="explain-sentences">
              {result.mappings.map((m, i) => {
                const color = PALETTE[i % PALETTE.length]
                const active = activeIdx === i
                return (
                  <div
                    key={i}
                    className={`explain-sentence${active ? ' explain-sentence-active' : ''}`}
                    style={active ? { borderLeft: `3px solid ${color}`, background: `${color}11` } : {}}
                    onClick={() => setActiveIdx(active ? null : i)}
                  >
                    <span className="explain-sentence-num" style={{ color }}>{i + 1}</span>
                    <span>{m.sentence}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
