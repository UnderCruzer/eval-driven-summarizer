export interface Pattern {
  category: string
  description: string
  frequency: number
  improvement_hint: string
}

export interface Proposal {
  id: number
  base_version: string
  new_version: string
  new_system_prompt: string
  new_user_template: string
  rationale: string
  avg_score: number
  weak_metric: string
  patterns: Pattern[]
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  decided_at: string | null
}

export type EvalStatus = 'idle' | 'running' | 'done' | 'error'

export interface StatusState {
  status: EvalStatus
  version?: string
  total?: number
  done?: number
  error?: string
}

export interface VersionAvg {
  prompt_version: string
  total_score: number
  key_point_coverage: number
  faithfulness: number
  information_loss: number
  length_adequacy: number
  doc_count: number
}

export interface FailureCase {
  id: number
  run_id: string
  doc_id: string
  doc_type: string
  prompt_version: string
  summary: string
  key_point_coverage: number
  faithfulness: number
  information_loss: number
  length_adequacy: number
  total_score: number
  grade: string
  reasoning: Record<string, string> | string
  created_at: string
}

export interface TraceRow {
  id: number
  run_id: string
  doc_id: string
  stage: string
  input_data: Record<string, unknown> | string
  output_data: Record<string, unknown> | string
  elapsed_ms: number
  error: string | null
}

export type SSEEventType =
  | { type: 'start'; total: number; version: string; run_id: string }
  | { type: 'progress'; done: number; total: number; doc_id: string; grade: string; total_score: number }
  | { type: 'done'; avg_score: number; run_id: string }
  | { type: 'error'; message: string }
