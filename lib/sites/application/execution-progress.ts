import { z } from 'zod'
import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { analysisTaskWhere, taskInputSchema } from '@/lib/audit/progressive/contracts'
import { categoryExecutionRecovery, executionRecovery, type ExecutionRecovery } from '../execution-recovery'
import type { SiteCardArea } from '../card-areas'
import { summarizeExecutionTasks, type ExecutionTaskSummary } from '../execution-summary'

export type ExecutionProgress = {
  summary?: ExecutionTaskSummary
  recovery?: ExecutionRecovery | null
  categoryRecovery?: Partial<Record<SiteCardArea, ExecutionRecovery>>
  total: number; completed: number; running: number; pending: number; recovering: number; unknown: number; inapplicable: number;
  recoveryUntil: string | null; eventCursor: string | null;
  tasks: Array<{ id: string; kind: string; module?: string | null; device?: 'desktop' | 'mobile' | null; pageUrl: string; state: string; attempts: number; reason: string | null; retryAt: string | null }>;
}
function siteAuditScope(site: SiteRecord) { return site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' } }
export function encodeEventCursor(siteId: string, sequence: bigint) {
  return Buffer.from(JSON.stringify({ version: 1, siteId, sequence: sequence.toString() })).toString('base64url')
}
export function decodeEventCursor(siteId: string, value: string | null) {
  if (!value) return BigInt(0)
  try {
    if (value.length > 512) throw new Error()
    const parsed = z.object({ version: z.literal(1), siteId: z.literal(siteId), sequence: z.string().regex(/^\d{1,19}$/) }).strict()
      .parse(JSON.parse(Buffer.from(value, 'base64url').toString()))
    const number = BigInt(parsed.sequence)
    if (number > BigInt('9223372036854775807')) throw new Error()
    return number
  } catch { throw new Error('Invalid Site event cursor') }
}

/** Read-only, tenant-scoped notices. No raw collector payloads or ledger logs. */
export async function readSiteEvents(site: SiteRecord, after: bigint) {
  return prisma.auditPipelineEvent.findMany({ where: { event: 'projection_changed', sequence: { gt: after }, audit: siteAuditScope(site) },
    orderBy: { sequence: 'asc' }, take: 100, select: { sequence: true, auditId: true, detail: true } })
}

export async function loadExecutionProgress(site: SiteRecord, auditId: string | null): Promise<ExecutionProgress | null> {
  if (!auditId) return null
  const audit = await prisma.audit.findFirst({ where: { AND: [{ id: auditId }, siteAuditScope(site)] },
    select: { recoveryUntil: true, verifierExecutions: { where: analysisTaskWhere,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 1200,
      select: { id: true, status: true, workState: true, workKind: true, workInput: true, workAttempts: true, workErrorCode: true, workRetryAt: true } } } })
  if (!audit?.verifierExecutions.length) return null
  const rows = audit.verifierExecutions
  const counts = await prisma.auditVerifierExecution.groupBy({
    by: ['status', 'workState', 'workErrorCode'], where: { auditId, ...analysisTaskWhere }, _count: { _all: true },
  })
  const summary = summarizeExecutionTasks(counts.map(row => ({ ...row, count: row._count._all })))
  const countState = (states: string[]) => counts.reduce((sum, row) => sum + (row.status !== 'NOT_APPLICABLE' && states.includes(row.workState ?? '') ? row._count._all : 0), 0)
  const events = await prisma.auditPipelineEvent.findFirst({ where: { event: 'projection_changed', audit: siteAuditScope(site) },
    orderBy: { sequence: 'desc' }, select: { sequence: true } })
  const tasks = rows.map(row => {
    const input = taskInputSchema.parse(row.workInput)
    return { id: row.id, kind: row.workKind!, module: input.module ?? null, device: input.device ?? null, pageUrl: input.pageUrl,
      state: row.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : row.workState!, attempts: row.workAttempts,
      reason: row.workErrorCode, retryAt: row.workRetryAt?.toISOString() ?? null }
  })
  return { summary, recovery: executionRecovery(tasks), categoryRecovery: categoryExecutionRecovery(tasks), total: summary.total, completed: summary.recorded,
    running: countState(['RUNNING']), pending: countState(['WAITING', 'READY']),
    recovering: summary.recovering, unknown: summary.limited + summary.failed,
    inapplicable: summary.notApplicable,
    recoveryUntil: audit.recoveryUntil?.toISOString() ?? null,
    eventCursor: events ? encodeEventCursor(site.siteId, events.sequence) : null,
    tasks: tasks.slice(0, 100) }
}
