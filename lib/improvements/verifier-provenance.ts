import type { Prisma, VerifierExecutionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { baseCheckId } from '@/lib/audit/flag-identity'
import { AUDIT_CAPABILITIES } from '@/lib/audit/capability-matrix'

type DbClient = typeof prisma | Prisma.TransactionClient

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.replace(/\/$/, '')
  }
}

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

export function verifierScopeKey(pageUrl: string | null): string {
  return pageUrl ? `page:${normalizeUrl(pageUrl)}` : 'product'
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
}, db: DbClient = prisma) {
  const targetKey = verifierTargetKey(input)
  if (!targetKey) throw new Error('Verifier execution requires a stable target identity')
  const scopeKey = verifierScopeKey(input.pageUrl)
  return db.auditVerifierExecution.upsert({
    where: { auditId_targetKey_scopeKey: { auditId: input.auditId, targetKey, scopeKey } },
    create: {
      auditId: input.auditId,
      targetKey,
      source: input.source,
      checkId: baseCheckId(input.checkId),
      pageUrl: input.pageUrl,
      scopeKey,
      status: input.status,
      evidenceReference: input.evidenceReference,
      detail: input.detail,
    },
    update: {
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

function journeyCheckMatchesType(checkId: string, journeyType: string): boolean {
  if (journeyType === 'multi-step-funnel') return checkId.startsWith('journey-funnel-')
  if (journeyType === 'contact-support') return checkId.startsWith('journey-contact-')
  return checkId.startsWith(`journey-${journeyType}-`)
}

/** Records a journey target only after that exact journey completed and revisited its scope. */
export async function recordTargetedJourneyVerifierExecutions(input: {
  auditId: string
  journeyType: string
  visitedUrls: string[]
}, db: DbClient = prisma): Promise<number> {
  const audit = await db.audit.findUnique({ where: { id: input.auditId }, select: { parentId: true } })
  if (!audit?.parentId) return 0
  const attempts = await db.improvementAttempt.findMany({
    where: { sourceAuditId: audit.parentId, outcome: null },
    select: { improvement: { select: { occurrences: {
      where: { auditId: audit.parentId },
      select: { flag: { select: {
        source: true, checkId: true, fingerprint: true, pageUrl: true,
      } } },
    } } } },
  })
  const visited = new Set(input.visitedUrls.map(normalizeUrl))
  const targets = new Map<string, {
    source: string; checkId: string; fingerprint: string | null; pageUrl: string | null
  }>()
  for (const attempt of attempts) {
    for (const occurrence of attempt.improvement.occurrences) {
      const flag = occurrence.flag
      const checkId = baseCheckId(flag.checkId)
      if (!checkId || flag.source !== 'JOURNEY' || !journeyCheckMatchesType(checkId, input.journeyType)) continue
      if (flag.pageUrl && !visited.has(normalizeUrl(flag.pageUrl))) continue
      targets.set(`${checkId}:${verifierScopeKey(flag.pageUrl)}`, {
        source: flag.source, checkId, fingerprint: flag.fingerprint, pageUrl: flag.pageUrl,
      })
    }
  }
  for (const target of targets.values()) {
    await recordVerifierExecution({
      auditId: input.auditId,
      source: target.source,
      checkId: target.checkId,
      fingerprint: target.fingerprint,
      pageUrl: target.pageUrl,
      status: 'COMPLETED',
      evidenceReference: {
        kind: 'journey-verifier-execution',
        reviewId: input.auditId,
        journeyType: input.journeyType,
        visitedScope: target.pageUrl ? normalizeUrl(target.pageUrl) : 'product',
      },
    }, db)
  }
  return targets.size
}
