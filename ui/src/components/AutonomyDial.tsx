import { useEffect, useState } from 'react'
import { getAutonomy, setAutonomy } from '../api/client'

export function AutonomyDial() {
  const [threshold, setThreshold] = useState(4.0)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAutonomy().then((d) => {
      setThreshold(d.threshold)
      setEnabled(d.enabled)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    await setAutonomy({ threshold, enabled })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const confidenceLabel =
    threshold >= 4.5 ? '매우 보수적' :
    threshold >= 4.0 ? '보수적' :
    threshold >= 3.5 ? '균형' :
    threshold >= 3.0 ? '자율적' : '완전 자율'

  const confidenceColor =
    threshold >= 4.5 ? 'var(--green)' :
    threshold >= 3.5 ? 'var(--yellow)' : 'var(--red)'

  return (
    <div className="autonomy-panel">
      <div className="autonomy-header">
        <span className="autonomy-title">Autonomy Dial</span>
        <div className="autonomy-toggle">
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>자동 승인</span>
          <button
            className={`toggle-btn${enabled ? ' toggle-on' : ''}`}
            onClick={() => setEnabled((v) => !v)}
          >
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      <div className="autonomy-body">
        <div className="autonomy-slider-row">
          <span className="autonomy-label">임계값</span>
          <input
            type="range"
            min={2.0} max={5.0} step={0.1}
            value={threshold}
            disabled={!enabled}
            onChange={(e) => setThreshold(parseFloat(e.target.value))}
            className="autonomy-slider"
          />
          <span className="autonomy-value">{threshold.toFixed(1)}</span>
          <span className="badge" style={{
            background: `${confidenceColor}22`,
            color: confidenceColor,
            opacity: enabled ? 1 : 0.4,
          }}>
            {confidenceLabel}
          </span>
        </div>

        <p className="autonomy-desc">
          {enabled
            ? `평균 점수 ≥ ${threshold.toFixed(1)} 이면 에이전트가 자동 승인합니다.`
            : '자동 승인 비활성화 — 모든 제안을 사람이 검토합니다.'}
        </p>

        <button className="btn-primary" style={{ fontSize: 13, padding: '6px 16px' }}
          onClick={handleSave} disabled={saving}>
          {saved ? '✓ 저장됨' : saving ? '저장 중…' : '저장'}
        </button>
      </div>
    </div>
  )
}
