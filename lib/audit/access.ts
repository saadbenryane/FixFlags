import { Audit } from '@prisma/client'

const FREE_FINDING_LIMIT = 3

type SessionUser = { id: string } | null | undefined

export function canAccessAudit(
  audit: Pick<Audit, 'userId' | 'isPublic'>,
  sessionUser: SessionUser
): boolean {
  if (audit.isPublic) return true
  if (audit.userId === null) return true
  if (sessionUser?.id && audit.userId === sessionUser.id) return true
  return false
}

export function canManageAudit(
  audit: Pick<Audit, 'userId'>,
  sessionUser: SessionUser
): boolean {
  if (!audit.userId) return false
  return sessionUser?.id === audit.userId
}

interface FindingRow {
  id: string
  severity: string
  problem: string
  evidence: string
  whyItMatters: string
  fix: string
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  verificationRule?: string | null
  status?: string
  checkId?: string | null
}

interface AreaRow {
  id: string
  name: string
  grade: string
  score: number | null
  status: string
  summary: string
  areaPrompt: string
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  findings: FindingRow[]
}

/** Strip paid-only content server-side for free/anonymous users. */
export function gateAuditResponse<T extends {
  areas: AreaRow[]
}>(audit: T, isPaid: boolean): T {
  if (isPaid) return audit

  return {
    ...audit,
    areas: audit.areas.map((area) => ({
      ...area,
      findings: area.findings.slice(0, FREE_FINDING_LIMIT).map((f) => ({
        ...f,
        agentPrompt: null,
        cursorPrompt: null,
        claudePrompt: null,
        // Keep no-code-builder prompts on free tier — primary ICP uses Lovable/Bolt
        lovablePrompt: f.lovablePrompt ?? null,
        boltPrompt: f.boltPrompt ?? null,
        verificationRule: null,
      })),
      cursorPrompt: null,
      claudePrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
    })),
  }
}

export { FREE_FINDING_LIMIT }
