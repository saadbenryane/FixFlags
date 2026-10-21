import type { Prisma } from '@prisma/client'
import { PAGE_COLLECTION_UNAVAILABLE } from '@/lib/marketing/copy/page-evidence'
import { MAX_TASKS_PER_AUDIT, TaskFailure, taskArtifactSchema } from './contracts'
import { browserArtifactSchema } from './snapshots'

const activePageStates = ['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING'] as const
const collectedPageSchema = browserArtifactSchema.pick({ pageId: true, metadata: true })

/** Finalization owns page settlement. Optional evaluators cannot leave a native
 * collection running forever or turn unavailable collection into success. */
export async function settleRecordedPages(tx: Prisma.TransactionClient, auditId: string) {
  const pages = await tx.auditPage.findMany({ where: { auditId, status: { in: [...activePageStates] } },
    select: { id: true, url: true, completeness: true }, take: MAX_TASKS_PER_AUDIT + 1 })
  if (!pages.length) return
  if (pages.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  // Keep collection proof small. Whole HTML, network traces and media are not
  // needed to settle the lifecycle of an already committed browser observation.
  const tasks = await tx.$queryRaw<Array<{ pageUrl: string; workResult: unknown }>>`
    SELECT "pageUrl", jsonb_set("workResult", '{data}', jsonb_build_object(
      'pageId', "workResult"->'data'->'pageId', 'metadata', "workResult"->'data'->'metadata')) AS "workResult"
    FROM "audit_verifier_executions"
    WHERE "auditId" = ${auditId} AND "targetKey" LIKE 'task:%' AND "workKind" = 'browser'
      AND "workState" = 'COMPLETED' AND "status" = 'COMPLETED'
      AND "pageUrl" = "workInput"->>'pageUrl'
    LIMIT ${MAX_TASKS_PER_AUDIT + 1}`
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  for (const task of tasks) {
    const artifact = taskArtifactSchema.safeParse(task.workResult)
    if (!artifact.success || artifact.data.kind !== 'browser') continue
    const collected = collectedPageSchema.safeParse(artifact.data.data)
    if (!collected.success || !collected.data.metadata) continue
    const page = pages.find(page => page.id === collected.data.pageId && page.url === task.pageUrl)
    if (!page) continue
    await tx.auditPage.updateMany({ where: { id: collected.data.pageId, auditId, url: task.pageUrl,
      status: { in: [...activePageStates] } }, data: { status: 'COMPLETED',
      completeness: page.completeness === 'UNKNOWN' ? 'PARTIAL' : page.completeness, failureCode: null, failureMessage: null } })
  }
  await tx.auditPage.updateMany({ where: { auditId, status: { in: [...activePageStates] } },
    data: { status: 'FAILED', completeness: 'PARTIAL', failureCode: 'BROWSER_SCOPE_UNAVAILABLE', failureMessage: PAGE_COLLECTION_UNAVAILABLE } })
}
