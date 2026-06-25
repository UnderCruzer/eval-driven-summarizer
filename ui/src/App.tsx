import { useState } from 'react'
import { DashboardTab } from './components/dashboard/DashboardTab'
import { PlaygroundTab } from './components/PlaygroundTab'
import { AgentLabTab } from './components/AgentLabTab'
import { ExplainTab } from './components/ExplainTab'
import './index.css'

type TabId = 'playground' | 'agentlab' | 'explain' | 'dashboard'

const TABS: { id: TabId; label: string }[] = [
  { id: 'playground', label: 'Playground' },
  { id: 'agentlab',   label: '에이전트 실험' },
  { id: 'explain',    label: '출처 분석' },
  { id: 'dashboard',  label: '대시보드' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('playground')

  return (
    <>
      <header>
        <h1>Eval-Driven Summarizer</h1>
        <p>문서를 입력하면 에이전트가 요약하고 평가합니다. 점수가 낮으면 개선안을 제안합니다.</p>
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

        {activeTab === 'playground' && <PlaygroundTab />}
        {activeTab === 'agentlab'   && <AgentLabTab />}
        {activeTab === 'explain'    && <ExplainTab />}
        {activeTab === 'dashboard'  && <DashboardTab />}
      </main>
    </>
  )
}
