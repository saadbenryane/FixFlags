import { z } from 'zod'
import { prisma } from '@/lib/db'
import { Prisma, type AuditExecutionTask } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'
import { analysisTaskWhere, MAX_TASKS_PER_AUDIT } from '@/lib/audit/progressive/contracts'
import { categoryExecutionRecovery, executionRecovery, type ExecutionRecovery } from '../execution-recovery'
import type { SiteCardArea } from '../card-areas'
import { summarizeExecutionTasks, type ExecutionTaskSummary } from '../execution-summary'
import { categoryExecutionActivity, type CategoryActivity } from '../card-execution'
import { captureCollectionState, type CaptureCollectionState } from '../captures'

export type ExecutionProgress = {
  captureState?: CaptureCollectionState
  summary?: ExecutionTaskSummary
  recovery?: ExecutionRecovery | null
  categoryRecovery?: Partial<Record<SiteCardArea, ExecutionRecovery>>
  categoryActivity?: CategoryActivity
  total: number; completed: number; running: number; pending: number; recovering: number; unknown: number; inapplicable: number;
  recoveryUntil: string | null; eventCursor: string | null;
  tasks: Array<{ id: string; kind: string; module?: string | null; device?: 'desktop' | 'mobile' | null; pageUrl: string; state: string; attempts: number; reason: string | null; retryAt: string | null }>;
}
function siteAuditScope(site: SiteRecord) { return site.projectId ? { projectId: site.projectId } : { id: site.primaryAuditId ?? '' } }
type ProgressTask = Pick<AuditExecutionTask, 'id' | 'status' | 'workState' | 'workKind' | 'pageUrl' |
  'workAttempts' | 'workErrorCode' | 'workRetryAt'> & { module: string | null; device: 'desktop' | 'mobile' | null; primary: boolean }
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
    select: { status: true, recoveryUntil: true } })
  if (!audit) return null
  // Display facts do not require decoding today's executable task contract.
  // Extract only the scalar fields used here, never whole control cohorts,
  // credentials, fixture definitions, or historical collector payloads.
  const rows = await prisma.$queryRaw<ProgressTask[]>`
    SELECT task.id, task.status, task."workState", task."workKind", task."workAttempts", task."workErrorCode", task."workRetryAt",
      COALESCE(task."pageUrl", CASE WHEN jsonb_typeof(task."workInput"->'pageUrl') = 'string'
        THEN task."workInput"->>'pageUrl' END) AS "pageUrl",
      CASE WHEN jsonb_typeof(task."workInput"->'module') = 'string' AND length(task."workInput"->>'module') BETWEEN 1 AND 120
        THEN task."workInput"->>'module' END AS module,
      CASE WHEN task."workInput"->>'device' IN ('desktop', 'mobile') THEN task."workInput"->>'device' END AS device,
      COALESCE(task."workInput"->'primary' = 'true'::jsonb, false) AS primary
    FROM audit_execution_tasks task JOIN audits audit ON audit.id = task."auditId"
    WHERE audit.id = ${auditId} AND ${site.projectId ? Prisma.sql`audit."projectId" = ${site.projectId}`
      : Prisma.sql`audit.id = ${site.primaryAuditId ?? ''}`}
      AND (task."workKind" IS NULL OR task."workKind" <> 'prescription')
    ORDER BY task."createdAt", task.id LIMIT ${MAX_TASKS_PER_AUDIT}`
  if (!rows.length) return null
  const counts = await prisma.auditExecutionTask.groupBy({
    by: ['status', 'workState', 'workErrorCode'], where: { auditId, ...analysisTaskWhere, audit: siteAuditScope(site) }, _count: { _all: true },
  })
  if (!counts.length) return null
  const summary = summarizeExecutionTasks(counts.map(row => ({ ...row, count: row._count._all })))
  const countState = (states: string[]) => counts.reduce((sum, row) => sum + (row.status !== 'NOT_APPLICABLE' && states.includes(row.workState ?? '') ? row._count._all : 0), 0)
  const events = await prisma.auditPipelineEvent.findFirst({ where: { event: 'projection_changed', audit: siteAuditScope(site) },
    orderBy: { sequence: 'desc' }, select: { sequence: true } })
  const tasks = rows.map(row => ({ id: row.id, kind: row.workKind ?? '', module: row.module, device: row.device, pageUrl: row.pageUrl ?? '',
      state: row.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : row.workState ?? 'UNKNOWN', attempts: row.workAttempts,
      reason: row.workErrorCode, retryAt: row.workRetryAt?.toISOString() ?? null }))
  const captureState = captureCollectionState(audit.status, rows.filter(row => row.workKind === 'captures' && row.primary)
    .map(row => row.status === 'NOT_APPLICABLE' ? 'NOT_APPLICABLE' : row.workState ?? 'UNKNOWN'))
  return { captureState, summary, recovery: executionRecovery(tasks), categoryRecovery: categoryExecutionRecovery(tasks), categoryActivity: categoryExecutionActivity(tasks),
    total: summary.total, completed: summary.recorded,
    running: countState(['RUNNING']), pending: countState(['WAITING', 'READY']),
    recovering: summary.recovering, unknown: summary.limited + summary.failed,
    inapplicable: summary.notApplicable,
    recoveryUntil: audit.recoveryUntil?.toISOString() ?? null,
    eventCursor: events ? encodeEventCursor(site.siteId, events.sequence) : null,
    tasks: tasks.slice(0, 100) }
}
