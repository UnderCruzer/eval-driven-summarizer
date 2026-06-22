import type { EvalStatus } from '../types'

interface Props {
  status: EvalStatus
  progress?: { done: number; total: number; docId?: string; grade?: string }
}

const CONFIG = {
  idle:    { label: '대기 중',      cls: 'badge-idle' },
  running: { label: 'Eval 실행 중', cls: 'badge-running' },
  done:    { label: '완료',         cls: 'badge-done' },
  error:   { label: '오류',         cls: 'badge-error' },
}

export function StatusBadge({ status, progress }: Props) {
  const { label, cls } = CONFIG[status]
  const extra = status === 'running' && progress
    ? ` ${progress.done} / ${progress.total}${progress.docId ? ` — ${progress.docId} ${progress.grade ?? ''}` : ''}`
    : ''

  return (
    <span className={`badge ${cls}`}>
      <span className={`dot${status === 'running' ? ' dot-pulse' : ''}`} />
      {label}{extra}
    </span>
  )
}
