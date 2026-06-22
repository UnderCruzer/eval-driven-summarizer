import type { Proposal } from '../types'

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
