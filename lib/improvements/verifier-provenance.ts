import type { Prisma, VerifierExecutionStatus, AuditVerificationReceipt } from '@prisma/client'
import { prisma } from '@/lib/db'
import { baseCheckId } from '@/lib/audit/flag-identity'
import { AUDIT_CAPABILITIES } from '@/lib/audit/capability-matrix'
import { SEARCH_HANDLED_CHECK_IDS } from '@/lib/audit/search/inventory'
import { currentExecutionOwnership, executionWrite } from '@/lib/audit/execution-ownership'
import { registeredCheck } from '@/lib/audit/check-registry'

type DbClient = typeof prisma | Prisma.TransactionClient

import { normalizeVerifierUrl as normalizeUrl, verifierScopeKey } from './verifier-scope'
export { verifierScopeKey } from './verifier-scope'

export function verifierTargetKey(input: {
  source: string
  checkId: string | null
  fingerprint?: string | null
}): string | null {
  const checkId = baseCheckId(input.checkId)
  if (checkId) return `check:${checkId}`
  if (input.source === 'AI' && input.fingerprint?.trim()) {
    return `ai:${input.fingerprint.trim()}`
  }
  return null
}

export async function recordVerifierExecution(input: {
  auditId: string
  source: string
  checkId: string | null
  fingerprint?: string | null
  pageUrl: string | null
  status: VerifierExecutionStatus
  evidenceReference?: Prisma.InputJsonValue
  detail?: Prisma.InputJsonValue
}, db: DbClient = prisma): Promise<AuditVerificationReceipt> {
  if (db === prisma && currentExecutionOwnership()) return executionWrite(tx => recordVerifierExecution(input, tx))
  const targetKey = verifierTargetKey(input)
  if (!targetKey) throw new Error('Verifier execution requires a stable target identity')
  const scopeKey = verifierScopeKey(input.pageUrl)
  return db.auditVerificationReceipt.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey, scopeKey } },
    create: {
      auditId: input.auditId,
      taskId: currentExecutionOwnership()?.taskId,
      targetKey,
      source: input.source,
      checkId: baseCheckId(input.checkId),
      pageUrl: input.pageUrl,
      scopeKey,
      status: input.status,
      evidenceReference: input.evidenceReference,
      detail: input.detail,
      checkVersion: currentExecutionOwnership() ? registeredCheck(input.checkId)?.version : undefined,
      executionGeneration: currentExecutionOwnership()?.generation,
    },
    update: {
      taskId: currentExecutionOwnership()?.taskId,
      source: input.source,
      checkId: baseCheckId(input.checkId),
      pageUrl: input.pageUrl,
      status: input.status,
      evidenceReference: input.evidenceReference,
      detail: input.detail,
    },
  })
}

const CHECK_TOOL = new Map(
  AUDIT_CAPABILITIES.flatMap((capability) =>
    capability.checkIds.map((checkId) => [checkId, capability.tool] as const),
  ),
)

function samePage(left: string, right: string): boolean {
  return normalizeUrl(left) === normalizeUrl(right)
}

/**
 * Records only verifier work that the page pipeline positively performed.
 * Unknown, AI, journey, or unavailable flow checks deliberately receive no
 * success record, so reconciliation remains INCONCLUSIVE instead of inferring
 * improvement from an absent Flag.
 */
export async function recordTargetedPageVerifierExecutions(input: {
  auditId: string
  pageUrl: string
  primary: boolean
  failedModules: string[]
  flowCompleted: boolean
  availableTools: Array<'html-parse' | 'browser-capture' | 'flow-navigation' | 'pagespeed'>
}, db: DbClient = prisma): Promise<number> {
  if (db === prisma && currentExecutionOwnership()) return executionWrite(tx => recordTargetedPageVerifierExecutions(input, tx))
  const audit = await db.audit.findUnique({
    where: { id: input.auditId },
    select: { parentId: true },
  })
  if (!audit?.parentId) return 0

  const attempts = await db.improvementAttempt.findMany({
    where: { sourceAuditId: audit.parentId, outcome: null },
    select: {
      improvement: {
        select: {
          occurrences: {
            where: { auditId: audit.parentId },
            select: {
              flag: {
                select: {
                  source: true,
                  checkId: true,
                  fingerprint: true,
                  pageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  })

  const targets = new Map<string, {
    source: string
    checkId: string
    fingerprint: string | null
    pageUrl: string | null
    tool: string
  }>()
  for (const attempt of attempts) {
    for (const occurrence of attempt.improvement.occurrences) {
      const flag = occurrence.flag
      const checkId = baseCheckId(flag.checkId)
      if (!checkId || flag.source === 'AI' || checkId.startsWith('journey-')) continue
      if (SEARCH_HANDLED_CHECK_IDS.has(checkId)) continue
      // Ordinary capture does not establish a throttled timing observation.
      if (registeredCheck(checkId)?.module === 'slow-replay') continue
      if (flag.pageUrl && !samePage(flag.pageUrl, input.pageUrl)) continue
      if (!flag.pageUrl && !input.primary) continue
      const tool = CHECK_TOOL.get(checkId)
      if (!tool || tool === 'ai-judge' || tool === 'internal-guard') continue
      targets.set(`${checkId}:${verifierScopeKey(flag.pageUrl)}`, {
        source: flag.source,
        checkId,
        fingerprint: flag.fingerprint,
        pageUrl: flag.pageUrl,
        tool,
      })
    }
  }

  let recorded = 0
  for (const target of targets.values()) {
    const needsFlow = target.tool === 'flow-navigation'
    if (needsFlow && !input.primary) continue
    const toolAvailable = input.availableTools.includes(target.tool as never)
    const status: VerifierExecutionStatus = input.failedModules.length > 0
      ? 'FAILED'
      : !toolAvailable || (needsFlow && !input.flowCompleted)
        ? 'FAILED'
        : 'COMPLETED'
    await recordVerifierExecution({
      auditId: input.auditId,
      source: target.source,
      checkId: target.checkId,
      fingerprint: target.fingerprint,
      pageUrl: target.pageUrl,
      status,
      evidenceReference: status === 'COMPLETED'
        ? {
            kind: 'page-verifier-execution',
            reviewId: input.auditId,
            capturedPage: normalizeUrl(input.pageUrl),
            verifier: target.checkId,
            tool: target.tool,
          }
        : undefined,
      detail: {
        failedModules: input.failedModules,
        flowCompleted: input.flowCompleted,
        toolAvailable,
      },
    }, db)
    recorded += 1
  }
  return recorded
}
