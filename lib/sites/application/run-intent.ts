import type { Prisma,RunRequestSource } from '@prisma/client'
import type { CategoryArea } from '../domain/execution-spec'

export function safeContext(
  value: Record<string, string | number | boolean | null | undefined> | undefined,
): Prisma.InputJsonObject | undefined {
  if (!value) return undefined
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key, item]) =>
          key !== 'scheduled' && !/(url|email|prompt|evidence|html|content|message|secret|token)/i.test(key) &&
          item !== undefined,
      )
      .map(([key, item]) => {
        if (typeof item !== 'string') return [key, item]
        const trimmed = item.trim().slice(0, 160)
        const sensitive = /(?:https?:\/\/|bearer\s+|api[_-]?key|password|secret|token)/i.test(trimmed)
        return [key, sensitive ? '[redacted]' : trimmed]
      }),
  ) as Prisma.InputJsonObject
}

export type SiteRunVerificationTarget =
  | {
      kind: 'OUTCOME'
      outcomeId: string
      attemptId: string
      parentAuditId: string
    }
  | {
      kind: 'DIAGNOSTIC'
      pageUrl: string
      checkId: string
      attemptId: string
      parentAuditId: string
    }

export type RunInput = {
  projectId: string
  outcomeIds: string[]
  userId: string
  source: RunRequestSource
  operator?: import('@/lib/admin/domain-actor').AdminDomainActor
  expectedResponsibilityHash?: string
  scheduledClaim?: import('./scheduled-admission').ScheduledRunClaim
  /** Broad Site care derives enabled bindings; callers do not select them. */
  scope?: 'OUTCOMES' | 'SITE' | 'CATEGORY' | 'FIXTURE_SETUP' | 'ACCOUNT_CHECKS'
  categoryArea?: CategoryArea
  accountMode?: 'routine' | 'retest' | 'cleanup'
  fixtureId?: string
  environment?: string
  idempotencyKey?: string
  context?: Record<string, string | number | boolean | null | undefined>
  verificationAttemptId?: string
  parentAuditId?: string
  /** Page a Flag verify must recheck. Bindings still start from their own configuration. */
  url?: string
  verificationTarget?: SiteRunVerificationTarget
}

export function sameSelection(
  run: { selections?: Array<{ outcomeId: string }> },
  selectedIds: string[],
): boolean {
  const stored = (run.selections ?? []).map((selection) => selection.outcomeId).sort()
  return stored.length === selectedIds.length && stored.every((id, index) => id === selectedIds[index])
}

export function verificationTargetIdentity(value: Prisma.JsonValue | SiteRunVerificationTarget | null | undefined): string | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null
  const target = value as Record<string, unknown>
  if (target.kind === 'OUTCOME') {
    return JSON.stringify(['OUTCOME', target.outcomeId, target.attemptId, target.parentAuditId])
  }
  if (target.kind === 'DIAGNOSTIC') {
    return JSON.stringify(['DIAGNOSTIC', target.pageUrl, target.checkId, target.attemptId, target.parentAuditId])
  }
  return JSON.stringify(value)
}

export function verificationTargetKind(value: Prisma.JsonValue | SiteRunVerificationTarget | null | undefined): string | null {
  if (!value || Array.isArray(value) || typeof value !== 'object') return null
  const kind = (value as Record<string, unknown>).kind
  return typeof kind === 'string' ? kind : null
}

export function sameExecutionScope(
  run: { selections?: Array<{ outcomeId: string }>; verificationTarget?: Prisma.JsonValue | null },
  selectedIds: string[],
  verificationTarget: SiteRunVerificationTarget | undefined,
): boolean {
  return sameSelection(run, selectedIds) &&
    verificationTargetIdentity(run.verificationTarget) === verificationTargetIdentity(verificationTarget)
}
