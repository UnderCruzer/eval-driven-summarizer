import { useState } from 'react'
import { runDebate } from '../api/client'

const VERSIONS = ['v1', 'v2', 'v3']
const DOC_TYPES = ['news', 'paper', 'meeting', 'en_news']

type Verdict = {
  winner: 'A' | 'B' | 'tie'
  winner_reason: string
  a_strengths: string[]
  b_strengths: string[]
  a_weaknesses: string[]
  b_weaknesses: string[]
  final_verdict: string
}

type Result = {
  summary_a: { strategy: string; summary: string }
  summary_b: { strategy: string; summary: string }
  verdict: Verdict
}

const WINNER_COLOR = { A: 'var(--purple)', B: 'var(--green)', tie: 'var(--yellow)' }

export function DebateTab() {
  const [version, setVersion] = useState('v1')
  const [docType, setDocType] = useState('news')
  const [content, setContent] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')
  const [showDebate, setShowDebate] = useState(false)

  async function handleRun() {
    if (!content.trim()) return
    setLoading(true)
    setResult(null)
    setError('')
    setShowDebate(false)

    const steps = ['전략 A·B 동시 요약 중…', 'Judge 최적안 선정 중…']
    let i = 0
    setStep(steps[0])
    const interval = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1)
      setStep(steps[i])
    }, 7000)

    try {
      const kp = keyPoints.trim()
        ? keyPoints.split('\n').map((l) => l.trim()).filter(Boolean)
        : []
      const data = await runDebate({ version, doc_type: docType, content, key_points: kp })
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      clearInterval(interval)
      setLoading(false)
      setStep('')
    }
  }

  const best = result
    ? result.verdict.winner === 'B'
      ? result.summary_b
      : result.summary_a
    : null

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
          {loading ? step || '실행 중…' : '⚔️ 최적 요약 생성'}
        </button>
      </div>

      <div className="pg-inputs">
        <div className="pg-input-col">
          <label className="pg-label">원문</label>
          <textarea className="pg-textarea" rows={10} placeholder="문서를 붙여넣으세요…"
            value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="pg-input-col">
          <label className="pg-label">
            핵심 포인트 <span className="pg-optional">(선택 — Judge 판단 기준으로 활용)</span>
          </label>
          <textarea className="pg-textarea" rows={10} placeholder={"핵심 포인트 1\n핵심 포인트 2\n…"}
            value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} />
        </div>
      </div>

      {error && <div className="trace-error">{error}</div>}

      {result && best && (
        <div className="debate-result">

          {/* 최종 결과 — 크게 */}
          <div className="debate-best">
            <div className="debate-best-header">
              <span className="debate-best-label">✦ 최적 요약</span>
              <span className="debate-strategy-badge" style={{ color: WINNER_COLOR[result.verdict.winner] }}>
                {best.strategy} 채택
              </span>
            </div>
            <div className="debate-best-summary">{best.summary}</div>
            <p className="debate-verdict-reason">"{result.verdict.winner_reason}"</p>
          </div>

          {/* 토론 과정 토글 */}
          <button className="debate-toggle" onClick={() => setShowDebate((v) => !v)}>
            {showDebate ? '▲ 판단 과정 접기' : '▼ 판단 과정 보기'}
          </button>

          {showDebate && (
            <div className="debate-process">
              {/* A vs B 비교 */}
              <div className="debate-compare">
                <div className="debate-compare-col">
                  <div className="debate-compare-header">
                    <span className="pipeline-agent agent-a">전략 A</span>
                    <span className="debate-strategy">{result.summary_a.strategy}</span>
                    {result.verdict.winner === 'A' && <span>🏆</span>}
                  </div>
                  <div className="pg-summary" style={{ fontSize: 13 }}>{result.summary_a.summary}</div>
                  <div className="debate-points">
                    {result.verdict.a_strengths.map((s, i) => (
                      <div key={i} className="debate-point debate-point-pos">✓ {s}</div>
                    ))}
                    {result.verdict.a_weaknesses.map((w, i) => (
                      <div key={i} className="debate-point debate-point-neg">✗ {w}</div>
                    ))}
                  </div>
                </div>

                <div className="debate-compare-col">
                  <div className="debate-compare-header">
                    <span className="pipeline-agent agent-b">전략 B</span>
                    <span className="debate-strategy">{result.summary_b.strategy}</span>
                    {result.verdict.winner === 'B' && <span>🏆</span>}
                  </div>
                  <div className="pg-summary" style={{ fontSize: 13 }}>{result.summary_b.summary}</div>
                  <div className="debate-points">
                    {result.verdict.b_strengths.map((s, i) => (
                      <div key={i} className="debate-point debate-point-pos">✓ {s}</div>
                    ))}
                    {result.verdict.b_weaknesses.map((w, i) => (
                      <div key={i} className="debate-point debate-point-neg">✗ {w}</div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Judge 최종 판결 */}
              <div className="critique-directive" style={{ marginTop: 8 }}>
                <span className="pattern-cat">Judge 판결</span>
                <span>{result.verdict.final_verdict}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
