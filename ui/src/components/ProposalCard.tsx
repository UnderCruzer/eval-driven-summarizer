import { useState } from 'react'
import type { Proposal } from '../types'
import { approveProposal, rejectProposal } from '../api/client'
import { PatternList } from './PatternList'
import { DiffView } from './DiffView'

interface Props {
  proposal: Proposal
  onDecided: (msg: string, type: 'success' | 'error') => void
  onNewVersion: (version: string) => void
}

export function ProposalCard({ proposal, onDecided, onNewVersion }: Props) {
  const [newSystem, setNewSystem] = useState(proposal.new_system_prompt)
  const [newUser, setNewUser] = useState(proposal.new_user_template)
  const [decided, setDecided] = useState(proposal.status !== 'pending')

  async function handleApprove() {
    try {
      const data = await approveProposal(proposal.id, newSystem, newUser)
      setDecided(true)
      onDecided(data.message, 'success')
      if (data.new_version) onNewVersion(data.new_version)
    } catch (e) {
      onDecided((e as Error).message, 'error')
    }
  }

  async function handleReject() {
    try {
      const data = await rejectProposal(proposal.id)
      setDecided(true)
      onDecided(data.message, 'success')
    } catch (e) {
      onDecided((e as Error).message, 'error')
    }
  }

  return (
    <div className="proposal-card">
      <div className="proposal-header">
        <div className="version-badge">
          <span style={{ color: 'var(--text-muted)' }}>{proposal.base_version}</span>
          <span className="arrow">→</span>
          <span style={{ color: 'var(--green)' }}>{proposal.new_version}</span>
        </div>
        <div className="score-row">
          <div className="score-chip">
            평균 점수 <span>{proposal.avg_score} / 5.0</span>
          </div>
          <div className="score-chip">
            취약 지표 <span>{proposal.weak_metric}</span>
          </div>
        </div>
      </div>

      <div className="rationale">
        <strong>개선 근거</strong>
        <br />
        {proposal.rationale}
      </div>

      <PatternList patterns={proposal.patterns} />

      <DiffView
        baseVersion={proposal.base_version}
        newVersion={proposal.new_version}
        newSystem={newSystem}
        newUser={newUser}
        onSystemChange={setNewSystem}
        onUserChange={setNewUser}
      />

      <div className="action-bar">
        <button className="btn-approve" disabled={decided} onClick={handleApprove}>
          ✓ 승인
        </button>
        <button className="btn-reject" disabled={decided} onClick={handleReject}>
          ✕ 거절
        </button>
        <span className="edit-hint">오른쪽 프롬프트를 직접 수정한 뒤 승인할 수 있습니다.</span>
      </div>
    </div>
  )
}
