import { useState } from 'react'
import { runPlayground, runCrawlPipeline } from '../api/client'

const VERSIONS = ['v1', 'v2', 'v3']
const DOC_TYPES = [
  { value: 'news', label: '뉴스 (한국어)' },
  { value: 'paper', label: '논문 (한국어)' },
  { value: 'meeting', label: '회의록 (한국어)' },
  { value: 'en_news', label: 'News (English)' },
]

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--green)', B: 'var(--yellow)', C: '#f97316', F: 'var(--red)',
}

const METRIC_LABELS: Record<string, string> = {
  key_point_coverage: 'Coverage',
  faithfulness:       'Faithfulness',
  information_loss:   'Info Loss',
  length_adequacy:    'Length',
}

type Scores = {
  key_point_coverage: number
  faithfulness: number
  information_loss: number
  length_adequacy: number
  total_score: number
  grade: string
  reasoning: Record<string, string>
}

type Result = {
  title?: string
  content?: string
  summary: string
  prompt_version: string
  scores: Scores | null
}

type Mode = 'text' | 'url'

export function PlaygroundTab() {
  const [mode, setMode] = useState<Mode>('text')
  const [version, setVersion] = useState('v1')
  const [docType, setDocType] = useState('news')
  const [content, setContent] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [showContent, setShowContent] = useState(false)

  async function handleRun() {
    setLoading(true)
    setResult(null)
    setError('')
    try {
      const kp = keyPoints.trim()
        ? keyPoints.split('\n').map((l) => l.trim()).filter(Boolean)
        : []

      if (mode === 'url') {
        const data = await runCrawlPipeline({ url: url.trim(), version, doc_type: docType, key_points: kp })
        setResult(data)
      } else {
        const data = await runPlayground({ version, doc_type: docType, content, key_points: kp })
        setResult(data)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const canRun = mode === 'url' ? !!url.trim() : !!content.trim()

  return (
    <div className="playground">
      {/* 모드 선택 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['text', 'url'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setResult(null); setError('') }}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              border: '1px solid var(--border)',
              background: mode === m ? 'var(--accent)' : 'var(--surface)',
              color: mode === m ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: mode === m ? 600 : 400,
            }}
          >
            {m === 'text' ? '텍스트 입력' : 'URL 크롤링'}
          </button>
        ))}
      </div>

      {/* 설정 바 */}
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
            {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
        </div>
        <button className="btn-primary" disabled={loading || !canRun} onClick={handleRun}>
          {loading ? '처리 중…' : '▶ 실행'}
        </button>
      </div>

      {/* URL 입력 */}
      {mode === 'url' && (
        <input
          type="url"
          placeholder="https://..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--text)',
            fontSize: 14,
            marginBottom: 12,
            boxSizing: 'border-box',
          }}
        />
      )}

      {/* 텍스트 입력 */}
      {mode === 'text' && (
        <div className="pg-inputs">
          <div className="pg-input-col">
            <label className="pg-label">원문</label>
            <textarea
              className="pg-textarea"
              rows={12}
              placeholder="요약할 문서를 붙여넣으세요…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="pg-input-col">
            <label className="pg-label">
              핵심 포인트 <span className="pg-optional">(선택 — 한 줄에 하나, 입력 시 Judge 평가 실행)</span>
            </label>
            <textarea
              className="pg-textarea"
              rows={12}
              placeholder={"핵심 포인트 1\n핵심 포인트 2\n…"}
              value={keyPoints}
              onChange={(e) => setKeyPoints(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* URL 모드: 핵심 포인트 (선택) */}
      {mode === 'url' && (
        <div className="pg-input-col" style={{ marginBottom: 12 }}>
          <label className="pg-label">
            핵심 포인트 <span className="pg-optional">(선택 — 한 줄에 하나, 입력 시 Judge 평가 실행)</span>
          </label>
          <textarea
            className="pg-textarea"
            rows={4}
            placeholder={"핵심 포인트 1\n핵심 포인트 2\n…"}
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
          />
        </div>
      )}

      {error && <div className="trace-error" style={{ marginTop: 12 }}>{error}</div>}

      {result && (
        <div className="pg-result">
          {result.title && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>크롤링된 기사</div>
              <div style={{ fontWeight: 600, fontSize: 15 }}>{result.title}</div>
              {result.content && (
                <>
                  <button
                    style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0' }}
                    onClick={() => setShowContent((v) => !v)}
                  >
                    {showContent ? '▲ 본문 접기' : '▼ 본문 보기'} ({result.content.length.toLocaleString()}자)
                  </button>
                  {showContent && (
                    <pre style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', marginTop: 4 }}>
                      {result.content}
                    </pre>
                  )}
                </>
              )}
            </div>
          )}

          <div className="pg-result-header">
            <span className="tag tag-new">{result.prompt_version}</span>
            {result.scores && (
              <span className="badge" style={{
                background: `${GRADE_COLOR[result.scores.grade]}22`,
                color: GRADE_COLOR[result.scores.grade],
              }}>
                {result.scores.grade} · {result.scores.total_score} / 5.0
              </span>
            )}
          </div>

          <div className="pg-summary">{result.summary}</div>

          {result.scores && (
            <>
              <div className="metric-chips" style={{ marginTop: 16 }}>
                {(['key_point_coverage', 'faithfulness', 'information_loss', 'length_adequacy'] as const).map((k) => (
                  <div className="score-chip" key={k}>
                    {METRIC_LABELS[k]} <span>{result.scores![k]}</span>
                  </div>
                ))}
              </div>
              <div className="pg-reasoning">
                {Object.entries(result.scores.reasoning).map(([k, v]) => (
                  <div key={k} className="pg-reasoning-row">
                    <span className="pattern-cat">{METRIC_LABELS[k] ?? k}</span>
                    <span>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
