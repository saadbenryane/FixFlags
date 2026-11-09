import type { Prisma } from '@prisma/client'
import { PUBLIC_LINK_VERIFICATION_RULE } from '@/lib/audit/checks/destination-evidence'
import { checkReceiptSchema } from '@/lib/audit/checks/receipt'
import { createRecordedRecoveryReader } from '@/lib/audit/recovery-evidence'
import { matchesRecordedVerifierPage } from '@/lib/improvements/verifier-scope'
import { readRepairSources } from '@/lib/sites/domain/repair-source'
import type { AcquisitionCycle } from './acquisition-value-cohort'
import type { ValueRun } from './site-value-cohort'

export type PublicLinkFollowup = Map<string, Map<string, 'passed' | 'failed'>>
const LIMIT = 5_000

/** Use the same scoped receipt interpretation as verification, without changing the ledger. */
export async function readPublicLinkFollowup(tx: Pick<Prisma.TransactionClient, 'improvementAttempt' | 'auditVerificationReceipt'>,
  cycles: AcquisitionCycle[], runs: ValueRun[], matureWindows: ReadonlyMap<string, { start: Date; end: Date }>): Promise<PublicLinkFollowup> {
  const followup: PublicLinkFollowup = new Map()
  const watches = Map.groupBy(runs.filter(run => {
    const window = matureWindows.get(run.projectId)
    return window && run.source === 'WATCH' && run.environment === 'production' && run.status === 'COMPLETED' &&
      run.auditId && run.completedAt && run.requestedAt >= window.start && run.completedAt <= window.end
  }), run => run.projectId)
  const candidates = cycles.flatMap(cycle => {
    const flag = cycle.occurrence?.flag
    if (!watches.has(cycle.projectId) || !flag?.id || flag.checkId !== 'broken-internal-links' ||
      flag.verificationRule !== PUBLIC_LINK_VERIFICATION_RULE) return []
    return cycle.events.flatMap(event => event.id && event.attemptId && event.type === 'OUTCOME_ISSUED' &&
      event.transport === 'SYSTEM' && event.outcome === 'IMPROVED'
      ? [{ cycle, event, eventId: event.id, attemptId: event.attemptId, flagId: flag.id }] : [])
  })
  if (!candidates.length) return followup
  if (candidates.length > LIMIT) throw new Error('Public-link repair evidence exceeds reporting limit')
  const attempts = await tx.improvementAttempt.findMany({
    where: { id: { in: [...new Set(candidates.map(row => row.attemptId))] }, frozen: true },
    select: { id: true, verificationAuditId: true, sourceObservations: true },
  })
  const attemptsById = new Map(attempts.map(attempt => [attempt.id, attempt]))
  const pairs = []
  const auditIds = new Set<string>()
  let comparisons = 0
  for (const { cycle, event, eventId, attemptId, flagId } of candidates) {
    const attempt = attemptsById.get(attemptId)
    if (!attempt || attempt.verificationAuditId !== event.verificationAuditId) continue
    const sources = readRepairSources(attempt.sourceObservations)?.flags
    if (!sources?.some(flag => flag.id === flagId && flag.auditId === cycle.sourceAuditId) ||
      sources.some(flag => flag.checkId !== 'broken-internal-links' ||
        flag.verificationRule !== PUBLIC_LINK_VERIFICATION_RULE || !flag.supportingObservations)) continue
    for (const run of watches.get(cycle.projectId) ?? []) {
      if (!run.auditId || run.auditId === event.verificationAuditId || run.requestedAt <= event.occurredAt) continue
      comparisons += sources.length
      if (comparisons > LIMIT) throw new Error('Public-link follow-up exceeds reporting limit')
      pairs.push({ eventId, auditId: run.auditId, sources })
      auditIds.add(run.auditId)
    }
  }
  if (!pairs.length) return followup
  const receipts = await tx.auditVerificationReceipt.findMany({
    where: { auditId: { in: [...auditIds] }, targetKey: 'module:seo', status: 'COMPLETED' },
    take: LIMIT + 1,
    select: { auditId: true, targetKey: true, status: true, pageUrl: true, taskId: true, createdAt: true, detail: true,
      task: { select: { id: true, status: true, pageUrl: true } },
      audit: { select: { projectId: true, executionSpec: true, startedAt: true, completedAt: true } } },
  })
  if (receipts.length > LIMIT) throw new Error('Public-link check receipts exceed reporting limit')
  const timedReceipts = receipts.filter(receipt => {
    const { projectId, startedAt, completedAt } = receipt.audit
    const window = projectId ? matureWindows.get(projectId) : undefined
    if (!window || receipt.createdAt > window.end || !startedAt || !completedAt ||
      receipt.task?.status !== 'COMPLETED' || !receipt.task.pageUrl || !receipt.pageUrl) return false
    const parsed = checkReceiptSchema.safeParse(receipt.detail)
    if (!parsed.success || !parsed.data.execution || parsed.data.execution.taskId !== receipt.taskId ||
      !matchesRecordedVerifierPage(receipt.task.pageUrl, parsed.data.pageUrl)) return false
    const collectedAt = Date.parse(parsed.data.execution.collectedAt)
    return collectedAt >= startedAt.getTime() && collectedAt <= completedAt.getTime()
  })
  const readers = new Map([...Map.groupBy(timedReceipts, receipt => receipt.auditId)].map(([auditId, executions]) =>
    [auditId, createRecordedRecoveryReader({ auditId, executionSpec: executions[0].audit.executionSpec, executions })]))
  for (const { eventId, auditId, sources } of pairs) {
    const reader = readers.get(auditId)
    if (!reader) continue
    const verdicts = sources.map(reader.verdict)
    const verdict = verdicts.includes('failed') ? 'failed' : verdicts.every(verdict => verdict === 'passed') ? 'passed' : null
    if (!verdict) continue
    const audits = followup.get(eventId) ?? new Map()
    audits.set(auditId, verdict)
    followup.set(eventId, audits)
  }
  return followup
}
