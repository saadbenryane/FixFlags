import type { Prisma } from '@prisma/client'
import { PAGE_COLLECTION_UNAVAILABLE } from '@/lib/marketing/copy/page-evidence'
import { MAX_TASKS_PER_AUDIT, TaskFailure, taskArtifactSchema } from './contracts'
import { browserArtifactSchema } from './snapshots'
import { desktopCollectionSnapshotSchema, hasRecordedDesktopCollection } from './browser-evidence'

const activePageStates = ['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING'] as const
const settleablePageWhere = { OR: [{ status: { in: [...activePageStates] } },
  { status: 'FAILED', failureCode: 'BROWSER_SCOPE_UNAVAILABLE' }] } satisfies Prisma.AuditPageWhereInput
const collectedPageSchema = browserArtifactSchema.pick({ pageId: true, metadata: true }).extend({ snapshot: desktopCollectionSnapshotSchema.optional() })

/** Finalization owns page settlement. Optional evaluators cannot leave a native
 * collection running forever or turn unavailable collection into success. */
export async function settleRecordedPages(tx: Prisma.TransactionClient, auditId: string) {
  const pages = await tx.auditPage.findMany({ where: { auditId, ...settleablePageWhere },
    select: { id: true, url: true, status: true, completeness: true }, take: MAX_TASKS_PER_AUDIT + 1 })
  if (!pages.length) return
  if (pages.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  // Keep collection proof small. Whole HTML, network traces and media are not
  // needed to settle the lifecycle of an already committed browser observation.
  const tasks = await tx.$queryRaw<Array<{ pageUrl: string; device: string | null; desktopRequired: boolean; mobileObserved: boolean; workResult: unknown }>>`
    SELECT "pageUrl", "workInput"->>'device' AS device,
      EXISTS (SELECT 1 FROM audit_execution_tasks desktop WHERE desktop."auditId" = collected."auditId"
        AND desktop."pageUrl" = collected."pageUrl" AND desktop."workKind" = 'browser'
        AND COALESCE(desktop."workInput"->>'device', 'desktop') <> 'mobile') AS "desktopRequired",
      (jsonb_typeof("workResult"#>'{data,snapshot,captureMetrics}') = 'object'
        OR jsonb_typeof("workResult"#>'{data,snapshot,mobileAccessibility,evidence}') = 'object'
        OR "workResult"#>'{data,snapshot,consoleCoverage,mobile,complete}' = 'true'::jsonb) IS TRUE AS "mobileObserved",
      jsonb_set("workResult", '{data}', jsonb_build_object(
      'pageId', "workResult"->'data'->'pageId', 'metadata', "workResult"->'data'->'metadata',
      'snapshot', jsonb_strip_nulls(jsonb_build_object(
        'desktopHttpStatus', "workResult"#>'{data,snapshot,desktopHttpStatus}',
        'desktopFinalUrl', "workResult"#>'{data,snapshot,desktopFinalUrl}',
        'collectionRestrictions', "workResult"#>'{data,snapshot,collectionRestrictions}',
        'desktopLoadExperience', CASE WHEN jsonb_typeof("workResult"#>'{data,snapshot,desktopLoadExperience,observation}') = 'object'
          THEN jsonb_build_object('observation', "workResult"#>'{data,snapshot,desktopLoadExperience,observation}') END)))) AS "workResult"
    FROM "audit_execution_tasks" collected
    WHERE "auditId" = ${auditId} AND "workKind" = 'browser'
      AND "workState" = 'COMPLETED' AND "status" = 'COMPLETED'
      AND "pageUrl" = "workInput"->>'pageUrl'
    LIMIT ${MAX_TASKS_PER_AUDIT + 1}`
  if (tasks.length > MAX_TASKS_PER_AUDIT) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  for (const task of tasks) {
    const artifact = taskArtifactSchema.safeParse(task.workResult)
    if (!artifact.success || artifact.data.kind !== 'browser') continue
    const collected = collectedPageSchema.safeParse(artifact.data.data)
    if (!collected.success || !collected.data.metadata && !(task.device !== 'mobile' && hasRecordedDesktopCollection(collected.data.snapshot, task.pageUrl)) &&
      !(task.device === 'mobile' && !task.desktopRequired && task.mobileObserved)) continue
    const page = pages.find(page => page.id === collected.data.pageId && page.url === task.pageUrl)
    if (!page) continue
    // Retained parser-era gaps require positive native proof. Parsed metadata
    // alone cannot replace an already recorded collection failure.
    if (page.status === 'FAILED' && (task.device === 'mobile' || !hasRecordedDesktopCollection(collected.data.snapshot, task.pageUrl))) continue
    await tx.auditPage.updateMany({ where: { id: collected.data.pageId, auditId, url: task.pageUrl,
      ...settleablePageWhere }, data: { status: 'COMPLETED',
      completeness: page.completeness === 'UNKNOWN' ? 'PARTIAL' : page.completeness, failureCode: null, failureMessage: null } })
  }
  await tx.auditPage.updateMany({ where: { auditId, status: { in: [...activePageStates] } },
    data: { status: 'FAILED', completeness: 'PARTIAL', failureCode: 'BROWSER_SCOPE_UNAVAILABLE', failureMessage: PAGE_COLLECTION_UNAVAILABLE } })
}
