import { useState } from 'react'
import { runCrawlPipeline } from '../api/client'

const VERSIONS = ['v1', 'v2', 'v3']
const DOC_TYPES = [
  { value: 'news', label: '뉴스 (한국어)' },
  { value: 'paper', label: '논문 (한국어)' },
  { value: 'meeting', label: '회의록 (한국어)' },
  { value: 'en_news', label: 'News (English)' },
]

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--green)', B: 'var(--green)', C: 'var(--yellow)',
  D: 'var(--red)', F: 'var(--red)',
}

interface CrawlResult {
  title: string
  content: string
  summary: string
  prompt_version: string
  scores: {
    key_point_coverage: number
    faithfulness: number
    information_loss: number
    length_adequacy: number
    total_score: number
    grade: string
    reasoning: Record<string, string>
  } | null
}

export function CrawlTab() {
  const [url, setUrl] = useState('')
  const [version, setVersion] = useState('v1')
  const [docType, setDocType] = useState('news')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CrawlResult | null>(null)
  const [showContent, setShowContent] = useState(false)

  async function handleRun() {
    if (!url.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const data = await runCrawlPipeline({ url: url.trim(), version, doc_type: docType, key_points: [] })
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="tab-content">
      <h2 style={{ marginBottom: 4 }}>URL 크롤링 요약</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: 14 }}>
        URL을 입력하면 기사를 크롤링해 자동으로 요약하고 평가합니다.
      </p>

      <div className="run-panel" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="url"
            placeholder="https://..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRun()}
            style={{
              flex: 1,
              padding: '8px 12px',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
              fontSize: 14,
            }}
          />
          <button className="btn-primary" onClick={handleRun} disabled={loading || !url.trim()}>
            {loading ? '처리 중…' : '▶ 실행'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>버전</label>
            <select value={version} onChange={(e) => setVersion(e.target.value)}>
              {VERSIONS.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>문서 유형</label>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--red)22', border: '1px solid var(--red)', borderRadius: 6, color: 'var(--red)', fontSize: 13 }}>
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>크롤링된 기사</div>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{result.title}</div>
            <button
              style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => setShowContent((v) => !v)}
            >
              {showContent ? '▲ 본문 접기' : '▼ 본문 보기'} ({result.content.length.toLocaleString()}자)
            </button>
            {showContent && (
              <pre style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>
                {result.content}
              </pre>
            )}
          </div>

          <div className="card">
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
              요약 결과 <span className="badge">{result.prompt_version}</span>
            </div>
            <p style={{ lineHeight: 1.7, fontSize: 14 }}>{result.summary}</p>
          </div>

          {result.scores && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>평가 결과</span>
                <span style={{
                  fontSize: 20, fontWeight: 700,
                  color: GRADE_COLOR[result.scores.grade] ?? 'var(--text)',
                }}>
                  {result.scores.grade}
                </span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  {result.scores.total_score.toFixed(2)}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                {[
                  { key: 'key_point_coverage', label: '핵심 포인트 커버리지', weight: '35%' },
                  { key: 'faithfulness', label: '충실도', weight: '30%' },
                  { key: 'information_loss', label: '정보 손실', weight: '25%' },
                  { key: 'length_adequacy', label: '길이 적절성', weight: '10%' },
                ].map(({ key, label, weight }) => (
                  <div key={key} style={{ padding: '8px 10px', background: 'var(--bg)', borderRadius: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label} <span style={{ opacity: 0.6 }}>({weight})</span></div>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>
                      {(result.scores![key as keyof typeof result.scores] as number).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {result.scores!.reasoning[key]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
