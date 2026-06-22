import type { FailureCase, Proposal, TraceRow, VersionAvg } from '../types'

const BASE = ''

export async function startEval(version: string, docType?: string) {
  const res = await fetch(`${BASE}/eval/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version, doc_type: docType ?? null }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '실행 실패')
  }
  return res.json()
}

export async function fetchLatestProposal(): Promise<Proposal> {
  const res = await fetch(`${BASE}/proposals/latest`)
  if (!res.ok) throw new Error('제안 없음')
  return res.json()
}

export async function approveProposal(
  id: number,
  editedSystemPrompt?: string,
  editedUserTemplate?: string,
) {
  const res = await fetch(`${BASE}/proposals/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      edited_system_prompt: editedSystemPrompt,
      edited_user_template: editedUserTemplate,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '승인 실패')
  }
  return res.json()
}

export async function rejectProposal(id: number) {
  const res = await fetch(`${BASE}/proposals/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '거절 실패')
  }
  return res.json()
}

export async function fetchVersions(): Promise<{
  averages: VersionAvg[]
  grade_dist: Record<string, Record<string, number>>
}> {
  const res = await fetch(`${BASE}/dashboard/versions`)
  return res.json()
}

export async function fetchFailures(
  version: string,
  threshold: number,
): Promise<{ results: FailureCase[]; total: number }> {
  const params = new URLSearchParams({ threshold: String(threshold) })
  if (version) params.set('version', version)
  const res = await fetch(`${BASE}/dashboard/failures?${params}`)
  return res.json()
}

export async function fetchRunIds(): Promise<{ run_ids: string[] }> {
  const res = await fetch(`${BASE}/dashboard/run-ids`)
  return res.json()
}

export async function fetchTraces(
  runId: string,
  docId: string,
): Promise<{ traces: TraceRow[] }> {
  const params = new URLSearchParams()
  if (runId) params.set('run_id', runId)
  if (docId) params.set('doc_id', docId)
  const res = await fetch(`${BASE}/dashboard/traces?${params}`)
  return res.json()
}
