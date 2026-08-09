export type AgentMessageSource = 'scan' | 'model' | 'user'

export type AgentMessageKind =
  | 'instruction'
  | 'progress'
  | 'flag'
  | 'completion'
  | 'warning'
  | 'failure'
  | 'conversation'

export type AgentMessageState = 'complete' | 'active' | 'warning' | 'failed'

export type AgentEvidenceReference = {
  auditId: string
  flagId?: string
  timelineStep?: number
}

/** Shared transport envelope for deterministic scan updates and report conversation. */
export type AgentMessage = {
  id: string
  sessionId: string
  auditId?: string
  role: 'agent' | 'user'
  source: AgentMessageSource
  kind: AgentMessageKind
  state?: AgentMessageState
  content: string
  createdAt?: string
  flagId?: string
  evidenceRef?: AgentEvidenceReference
}
