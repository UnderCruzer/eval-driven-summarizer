import { useState } from 'react'
import { evalSingle, crawlUrl, approveProposal, rejectProposal } from '../api/client'

const VERSIONS = ['v1', 'v2', 'v3']
const DOC_TYPES = [
  { value: 'news', label: '뉴스 (한국어)' },
  { value: 'paper', label: '논문 (한국어)' },
  { value: 'meeting', label: '회의록 (한국어)' },
  { value: 'en_news', label: 'News (English)' },
]

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--green)', B: 'var(--yellow)', C: '#f97316', D: 'var(--red)', F: 'var(--red)',
}

const METRIC_LABELS: Record<string, string> = {
  key_point_coverage: 'Coverage',
  faithfulness: 'Faithfulness',
  information_loss: 'Info Loss',
  length_adequacy: 'Length',
}

type Mode = 'text' | 'url'

type Scores = {
  key_point_coverage: number
  faithfulness: number
  information_loss: number
  length_adequacy: number
  total_score: number
  grade: string
  reasoning: Record<string, string>
}

type ProposalData = {
  id: number
  base_version: string
  new_version: string
  new_system_prompt: string
  new_user_template: string
  rationale: string
  avg_score: number
  weak_metric: string
  patterns: { category: string; description: string; frequency: number; improvement_hint: string }[]
  status: 'pending' | 'approved' | 'rejected'
  auto_approved: boolean
}

type Result = {
  title?: string
  content?: string
  summary: string
  prompt_version: string
  scores: Scores
  proposal: ProposalData | null
}

export function PlaygroundTab() {
  const [mode, setMode] = useState<Mode>('text')
  const [version, setVersion] = useState('v1')
  const [docType, setDocType] = useState('news')
  const [content, setContent] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [showContent, setShowContent] = useState(false)
  const [deciding, setDeciding] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  async function handleRun() {
    setLoading(true)
    setResult(null)
    setError('')

    const steps = ['요약 생성 중…', '품질 평가 중…', '개선안 분석 중…']
    let i = 0
    setLoadingMsg(steps[0])
    const interval = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1)
      setLoadingMsg(steps[i])
    }, 5000)

    try {
      const kp = keyPoints.trim()
        ? keyPoints.split('\n').map((l) => l.trim()).filter(Boolean)
        : []

      if (mode === 'url') {
        // 크롤링 후 evalSingle로 전체 파이프라인 실행
        const crawled = await crawlUrl(url.trim())
        const data = await evalSingle({ version, doc_type: docType, content: crawled.content, key_points: kp })
        setResult({ ...data, title: crawled.title, content: crawled.content })
      } else {
        const data = await evalSingle({ version, doc_type: docType, content, key_points: kp })
        setResult(data)
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      clearInterval(interval)
      setLoading(false)
      setLoadingMsg('')
    }
  }

  async function handleApprove() {
    if (!result?.proposal) return
    setDeciding(true)
    try {
      await approveProposal(result.proposal.id)
      setResult((r) => r && r.proposal ? { ...r, proposal: { ...r.proposal, status: 'approved' } } : r)
      showToast(`${result.proposal.new_version} 승인 완료`, 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setDeciding(false)
    }
  }

  async function handleReject() {
    if (!result?.proposal) return
    setDeciding(true)
    try {
      await rejectProposal(result.proposal.id)
      setResult((r) => r && r.proposal ? { ...r, proposal: { ...r.proposal, status: 'rejected' } } : r)
      showToast('제안 거절됨', 'error')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setDeciding(false)
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
              padding: '6px 16px', borderRadius: 6,
              border: '1px solid var(--border)',
              background: mode === m ? 'var(--accent)' : 'var(--surface)',
              color: mode === m ? '#fff' : 'var(--text)',
              cursor: 'pointer', fontSize: 13,
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
          {loading ? loadingMsg || '처리 중…' : '▶ 실행'}
        </button>
      </div>

      {/* URL 입력 */}
      {mode === 'url' && (
        <input
          type="url" placeholder="https://..."
          value={url} onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
          style={{
            width: '100%', padding: '8px 12px',
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text)', fontSize: 14,
            marginBottom: 12, boxSizing: 'border-box',
          }}
        />
      )}

      {/* 텍스트 입력 */}
      {mode === 'text' && (
        <div className="pg-inputs">
          <div className="pg-input-col">
            <label className="pg-label">원문</label>
            <textarea className="pg-textarea" rows={12}
              placeholder="요약할 문서를 붙여넣으세요…"
              value={content} onChange={(e) => setContent(e.target.value)} />
          </div>
          <div className="pg-input-col">
            <label className="pg-label">
              핵심 포인트 <span className="pg-optional">(선택 — 한 줄에 하나)</span>
            </label>
            <textarea className="pg-textarea" rows={12}
              placeholder={"핵심 포인트 1\n핵심 포인트 2\n…"}
              value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} />
          </div>
        </div>
      )}

      {error && <div className="trace-error" style={{ marginTop: 12 }}>{error}</div>}

      {/* 결과 */}
      {result && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 크롤링 기사 정보 */}
          {result.title && (
            <div className="card">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>크롤링된 기사</div>
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

          {/* 요약 + 점수 */}
          <div className="pg-result">
            <div className="pg-result-header">
              <span className="tag tag-new">{result.prompt_version}</span>
              <span className="badge" style={{
                background: `${GRADE_COLOR[result.scores.grade]}22`,
                color: GRADE_COLOR[result.scores.grade],
              }}>
                {result.scores.grade} · {result.scores.total_score.toFixed(2)} / 5.0
              </span>
            </div>
            <div className="pg-summary">{result.summary}</div>
            <div className="metric-chips" style={{ marginTop: 16 }}>
              {(['key_point_coverage', 'faithfulness', 'information_loss', 'length_adequacy'] as const).map((k) => (
                <div className="score-chip" key={k}>
                  {METRIC_LABELS[k]} <span>{result.scores[k]}</span>
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
          </div>

          {/* 개선 제안 + 승인 게이트 */}
          {result.proposal && (
            <div className="card" style={{ border: '1px solid var(--accent)44' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>개선 제안</span>
                <span className="tag tag-new">{result.proposal.base_version}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→</span>
                <span className="tag tag-new" style={{ background: 'var(--accent)22', color: 'var(--accent)' }}>
                  {result.proposal.new_version}
                </span>
                {result.proposal.status === 'approved' && (
                  <span className="badge" style={{ background: 'var(--green)22', color: 'var(--green)' }}>승인됨</span>
                )}
                {result.proposal.status === 'rejected' && (
                  <span className="badge" style={{ background: 'var(--red)22', color: 'var(--red)' }}>거절됨</span>
                )}
                {result.proposal.auto_approved && (
                  <span className="badge" style={{ background: 'var(--green)22', color: 'var(--green)' }}>자동 승인</span>
                )}
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                {result.proposal.rationale}
              </p>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                취약 지표: <strong>{result.proposal.weak_metric}</strong>
              </div>

              {result.proposal.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-primary" disabled={deciding} onClick={handleApprove}
                    style={{ background: 'var(--green)' }}>
                    ✓ 승인
                  </button>
                  <button className="btn-primary" disabled={deciding} onClick={handleReject}
                    style={{ background: 'var(--red)' }}>
                    ✗ 거절
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 점수 높으면 개선 제안 없음 안내 */}
          {result.proposal === null && mode === 'text' && (
            <div style={{ padding: '10px 14px', background: 'var(--green)11', border: '1px solid var(--green)44', borderRadius: 6, fontSize: 13, color: 'var(--green)' }}>
              점수가 충분히 높아 개선 제안이 생성되지 않았습니다.
            </div>
          )}
        </div>
      )}

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  )
}
