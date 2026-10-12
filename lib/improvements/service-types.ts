import type { Clock } from '@/lib/time/clock'
import type { ImprovementStatus,VerificationOutcome } from '@prisma/client'

export type ImprovementServiceDependencies = { clock?: Clock }

export type ImprovementFlag = {
  id: string
  checkId: string | null
  rubric: string
  severity: string
  impactTag: string | null
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  agentPrompt: string | null
  cursorPrompt: string | null
  claudePrompt: string | null
  windsurfPrompt: string | null
  lovablePrompt: string | null
  boltPrompt: string | null
  verificationRule: string | null
  pageUrl: string | null
  confidence: number
  source: string
  status: string
  fingerprint?: string | null
}

export type VerificationResult = {
  improvementId: string
  attemptId: string
  outcome: VerificationOutcome
  status: ImprovementStatus
  problem: string
  checkId: string | null
  comparable: boolean
  reason: string
}

