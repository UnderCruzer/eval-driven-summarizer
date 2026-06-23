import { useState } from 'react'
import { runCritique } from '../api/client'

const VERSIONS = ['v1', 'v2', 'v3']
const DOC_TYPES = ['news', 'paper', 'meeting', 'en_news']

const GRADE_COLOR: Record<string, string> = {
  A: 'var(--green)', B: 'var(--yellow)', C: '#f97316', F: 'var(--red)',
}

const METRIC_LABELS: Record<string, string> = {
  key_point_coverage: 'Coverage',
  faithfulness: 'Faithfulness',
  information_loss: 'Info Loss',
  length_adequacy: 'Length',
}

type Scores = {
  key_point_coverage: number
  faithfulness: number
  information_loss: number
  length_adequacy: number
  total_score: number
  grade: string
} | null

type Result = {
  summary_a: string
  critique: { missing_points: string[]; factual_errors: string[]; improvement_directive: string }
  summary_b: string
  scores_a: Scores
  scores_b: Scores
}

function ScoreBar({ scores }: { scores: Scores }) {
  if (!scores) return null
  return (
    <div className="metric-chips" style={{ marginTop: 10 }}>
      {(['key_point_coverage', 'faithfulness', 'information_loss', 'length_adequacy'] as const).map((k) => (
        <div className="score-chip" key={k}>
          {METRIC_LABELS[k]} <span>{scores[k]}</span>
        </div>
      ))}
      <div className="badge" style={{
        background: `${GRADE_COLOR[scores.grade]}22`,
        color: GRADE_COLOR[scores.grade],
      }}>
        {scores.grade} · {scores.total_score}
      </div>
    </div>
  )
}

export function CritiqueTab() {
  const [version, setVersion] = useState('v1')
  const [docType, setDocType] = useState('news')
  const [content, setContent] = useState('')
  const [keyPoints, setKeyPoints] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState('')
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState('')

  async function handleRun() {
    if (!content.trim()) return
    setLoading(true)
    setResult(null)
    setError('')

    const steps = ['Summarizer A 요약 중…', 'Critic Agent 검토 중…', 'Summarizer B 개선 중…', 'Judge 평가 중…']
    let i = 0
    setStep(steps[0])
    const interval = setInterval(() => {
      i = Math.min(i + 1, steps.length - 1)
      setStep(steps[i])
    }, 6000)

    try {
      const kp = keyPoints.trim()
        ? keyPoints.split('\n').map((l) => l.trim()).filter(Boolean)
        : []
      const data = await runCritique({ version, doc_type: docType, content, key_points: kp })
      setResult(data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      clearInterval(interval)
      setLoading(false)
      setStep('')
    }
  }

  return (
    <div className="playground">
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
            {DOC_TYPES.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button className="btn-primary" disabled={loading || !content.trim()} onClick={handleRun}>
          {loading ? step || '실행 중…' : '▶ 크리틱 실행'}
        </button>
      </div>

      {/* 입력 */}
      <div className="pg-inputs">
        <div className="pg-input-col">
          <label className="pg-label">원문</label>
          <textarea className="pg-textarea" rows={10} placeholder="문서를 붙여넣으세요…"
            value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        <div className="pg-input-col">
          <label className="pg-label">
            핵심 포인트 <span className="pg-optional">(선택 — 입력 시 A/B 점수 비교)</span>
          </label>
          <textarea className="pg-textarea" rows={10} placeholder={"핵심 포인트 1\n핵심 포인트 2\n…"}
            value={keyPoints} onChange={(e) => setKeyPoints(e.target.value)} />
        </div>
      </div>

      {error && <div className="trace-error">{error}</div>}

      {/* 결과 — 3단계 파이프라인 */}
      {result && (
        <div className="critique-pipeline">

          {/* Step 1 — Summarizer A */}
          <div className="pipeline-step">
            <div className="pipeline-step-header">
              <span className="pipeline-agent agent-a">Summarizer A</span>
              <span className="pipeline-arrow">→</span>
              <span className="pipeline-label">초안 요약</span>
            </div>
            <div className="pg-summary">{result.summary_a}</div>
            <ScoreBar scores={result.scores_a} />
          </div>

          {/* Step 2 — Critic */}
          <div className="pipeline-step pipeline-step-critic">
            <div className="pipeline-step-header">
              <span className="pipeline-agent agent-critic">Critic Agent</span>
              <span className="pipeline-arrow">→</span>
              <span className="pipeline-label">검토 & 피드백</span>
            </div>
            {result.critique.missing_points.length > 0 && (
              <div className="critique-block">
                <p className="critique-block-title">빠진 정보</p>
                <ul className="failure-reasoning">
                  {result.critique.missing_points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}
            {result.critique.factual_errors.length > 0 && (
              <div className="critique-block">
                <p className="critique-block-title" style={{ color: 'var(--red)' }}>사실 오류</p>
                <ul className="failure-reasoning">
                  {result.critique.factual_errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <div className="critique-directive">
              <span className="pattern-cat">개선 지시</span>
              <span>{result.critique.improvement_directive}</span>
            </div>
          </div>

          {/* Step 3 — Summarizer B */}
          <div className="pipeline-step pipeline-step-b">
            <div className="pipeline-step-header">
              <span className="pipeline-agent agent-b">Summarizer B</span>
              <span className="pipeline-arrow">→</span>
              <span className="pipeline-label">개선된 요약</span>
            </div>
            <div className="pg-summary pg-summary-improved">{result.summary_b}</div>
            <ScoreBar scores={result.scores_b} />
            {result.scores_a && result.scores_b && (
              <div className="score-delta">
                개선폭
                <span className={result.scores_b.total_score >= result.scores_a.total_score
                  ? 'delta-pos' : 'delta-neg'}>
                  {result.scores_b.total_score >= result.scores_a.total_score ? '▲' : '▼'}
                  {Math.abs(result.scores_b.total_score - result.scores_a.total_score).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
