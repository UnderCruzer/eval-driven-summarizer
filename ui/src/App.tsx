import { useCallback, useRef, useState } from 'react'
import type { EvalStatus, Proposal, SSEEventType } from './types'
import { startEval, fetchLatestProposal } from './api/client'
import { useSSE } from './hooks/useSSE'
import { StatusBadge } from './components/StatusBadge'
import { ProposalCard } from './components/ProposalCard'
import { DashboardTab } from './components/dashboard/DashboardTab'
import { PlaygroundTab } from './components/PlaygroundTab'
import { CritiqueTab } from './components/CritiqueTab'
import { DebateTab } from './components/DebateTab'
import { ExplainTab } from './components/ExplainTab'
import { AutonomyDial } from './components/AutonomyDial'
import './index.css'

interface Progress {
  done: number
  total: number
  docId?: string
  grade?: string
}

interface Toast {
  msg: string
  type: 'success' | 'error'
}

const BASE_VERSIONS = ['v1', 'v2', 'v3']
const DOC_TYPES = [
  { value: '', label: '전체' },
  { value: 'news', label: '뉴스 (한국어)' },
  { value: 'paper', label: '논문 (한국어)' },
  { value: 'meeting', label: '회의록 (한국어)' },
  { value: 'en_news', label: 'News (English)' },
]
type TabId = 'approval' | 'playground' | 'critique' | 'debate' | 'explain' | 'dashboard'

const TABS: { id: TabId; label: string }[] = [
  { id: 'approval',   label: '승인 게이트' },
  { id: 'playground', label: 'Playground' },
  { id: 'critique',   label: '멀티 에이전트' },
  { id: 'debate',     label: '에이전트 토론' },
  { id: 'explain',    label: '출처 분석' },
  { id: 'dashboard',  label: '대시보드' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('approval')
  const [version, setVersion] = useState('v1')
  const [versions, setVersions] = useState(BASE_VERSIONS)
  const [docType, setDocType] = useState('')
  const [status, setStatus] = useState<EvalStatus>('idle')
  const [progress, setProgress] = useState<Progress | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [sseEnabled, setSseEnabled] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, type: 'success' | 'error') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const handleSSEEvent = useCallback((ev: SSEEventType) => {
    if (ev.type === 'start') {
      setProgress({ done: 0, total: ev.total })
    } else if (ev.type === 'progress') {
      setProgress({ done: ev.done, total: ev.total, docId: ev.doc_id, grade: ev.grade })
    } else if (ev.type === 'done') {
      setStatus('done')
      setSseEnabled(false)
      if (ev.auto_approved) {
        showToast(`자동 승인 완료 (점수 ${ev.avg_score} ≥ ${ev.threshold})`, 'success')
      } else {
        fetchLatestProposal()
          .then(setProposal)
          .catch(() => showToast('제안 로드 실패', 'error'))
      }
    } else if (ev.type === 'error') {
      setStatus('error')
      setSseEnabled(false)
      showToast('Eval 오류: ' + ev.message, 'error')
    }
  }, [])

  useSSE(sseEnabled, handleSSEEvent)

  async function handleRun() {
    setStatus('running')
    setProgress(null)
    setProposal(null)
    setSseEnabled(true)
    try {
      await startEval(version, docType || undefined)
    } catch (e) {
      setStatus('error')
      setSseEnabled(false)
      showToast((e as Error).message, 'error')
    }
  }

  function handleNewVersion(v: string) {
    setVersions((prev) => (prev.includes(v) ? prev : [...prev, v]))
    setVersion(v)
  }

  return (
    <>
      <header>
        <h1>Eval-Driven Summarizer</h1>
        <p>에이전트가 요약을 평가하고 개선안을 제안합니다. 사람이 검토 후 승인하세요.</p>
      </header>

      <main>
        <nav className="tab-nav">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab-btn${activeTab === t.id ? ' tab-active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {activeTab === 'approval' && (
          <>
            <AutonomyDial />
            <div className="run-panel">
              <div>
                <label>프롬프트 버전</label>
                <select value={version} onChange={(e) => setVersion(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label>문서 유형</label>
                <select value={docType} onChange={(e) => setDocType(e.target.value)}>
                  {DOC_TYPES.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
              <button
                className="btn-primary"
                disabled={status === 'running'}
                onClick={handleRun}
              >
                ▶ Eval 실행
              </button>
              <StatusBadge status={status} progress={progress ?? undefined} />
            </div>

            {proposal && (
              <ProposalCard
                proposal={proposal}
                onDecided={showToast}
                onNewVersion={handleNewVersion}
              />
            )}
          </>
        )}

        {activeTab === 'playground' && <PlaygroundTab />}
        {activeTab === 'critique'   && <CritiqueTab />}
        {activeTab === 'debate'     && <DebateTab />}
        {activeTab === 'explain'    && <ExplainTab />}
        {activeTab === 'dashboard'  && <DashboardTab />}
      </main>

      {toast && (
        <div className={`toast toast-${toast.type}`}>{toast.msg}</div>
      )}
    </>
  )
}
