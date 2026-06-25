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

export async function runPlayground(payload: {
  version: string
  doc_type: string
  content: string
  key_points: string[]
}): Promise<{
  summary: string
  prompt_version: string
  scores: {
    key_point_coverage: number
    faithfulness: number
    information_loss: number
    length_adequacy: number
    total_score: number
    grade: string
    reasoning: Record<string, string>
  } | null
}> {
  const res = await fetch(`${BASE}/playground/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '실행 실패')
  }
  return res.json()
}

export async function runCritique(payload: {
  version: string
  doc_type: string
  content: string
  key_points: string[]
}): Promise<{
  summary_a: string
  critique: { missing_points: string[]; factual_errors: string[]; improvement_directive: string }
  summary_b: string
  scores_a: { key_point_coverage: number; faithfulness: number; information_loss: number; length_adequacy: number; total_score: number; grade: string } | null
  scores_b: { key_point_coverage: number; faithfulness: number; information_loss: number; length_adequacy: number; total_score: number; grade: string } | null
}> {
  const res = await fetch(`${BASE}/playground/critique`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '실행 실패')
  }
  return res.json()
}

export async function getAutonomy(): Promise<{ threshold: number; enabled: boolean }> {
  const res = await fetch(`${BASE}/settings/autonomy`)
  return res.json()
}

export async function setAutonomy(payload: { threshold: number; enabled: boolean }) {
  const res = await fetch(`${BASE}/settings/autonomy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return res.json()
}

export async function runExplain(payload: {
  version: string
  doc_type: string
  content: string
}): Promise<{
  summary: string
  mappings: { sentence: string; source_quotes: string[] }[]
}> {
  const res = await fetch(`${BASE}/playground/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '실행 실패')
  }
  return res.json()
}

export async function runDebate(payload: {
  version: string
  doc_type: string
  content: string
  key_points: string[]
}): Promise<{
  summary_a: { strategy: string; summary: string }
  summary_b: { strategy: string; summary: string }
  verdict: {
    winner: 'A' | 'B' | 'tie'
    winner_reason: string
    a_strengths: string[]
    b_strengths: string[]
    a_weaknesses: string[]
    b_weaknesses: string[]
    final_verdict: string
  }
}> {
  const res = await fetch(`${BASE}/playground/debate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '실행 실패')
  }
  return res.json()
}

export async function evalSingle(payload: {
  version: string
  doc_type: string
  content: string
  key_points: string[]
}): Promise<{
  summary: string
  prompt_version: string
  scores: {
    key_point_coverage: number
    faithfulness: number
    information_loss: number
    length_adequacy: number
    total_score: number
    grade: string
    reasoning: Record<string, string>
  }
  proposal: {
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
  } | null
}> {
  const res = await fetch(`${BASE}/eval/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '실행 실패')
  }
  return res.json()
}

export async function crawlUrl(url: string): Promise<{ title: string; content: string }> {
  const res = await fetch(`${BASE}/crawl?url=${encodeURIComponent(url)}`)
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '크롤링 실패')
  }
  return res.json()
}

export async function runCrawlPipeline(payload: {
  url: string
  version: string
  doc_type: string
  key_points: string[]
}): Promise<{
  title: string
  content: string
  summary: string
  prompt_version: string
  scores: {
    key_point_coverage: number
    faithfulness: number
    information_loss: number
    length_adequacy: number
    total_score: number
    grade: string
    reasoning: Record<string, string>
  } | null
}> {
  const res = await fetch(`${BASE}/playground/crawl-run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail ?? '실행 실패')
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
