import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { derivePageSpeedCoverage } from './pagespeed-coverage'
import { MAX_TASKS_PER_AUDIT, TaskFailure } from './progressive/contracts'

type ReportPerformance = { id: string; url: string; executionSpec?: unknown; performanceData: unknown;
  pages: Array<{ url: string; performanceData: unknown }> }

/** Progressive collectors own the recorded facts. Legacy page summaries remain
 * the source for older reports, without copying task payloads into another ledger. */
export async function loadRecordedPageSpeedCoverage(audit: ReportPerformance, db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma) {
  const routes = audit.pages.length ? audit.pages : [{ url: audit.url, performanceData: audit.performanceData }]
  if (readExecutionSpec(audit.executionSpec)?.engine !== 'progressive-v1') return derivePageSpeedCoverage(routes)
  // Coverage needs scalar measurements and their timing, never raw provider
  // traces or resource tables. Preserve exact Audit and page attribution.
  const rows = await db.$queryRaw<Array<{ pageUrl: string; device: string; observation: unknown }>>`
    SELECT task."pageUrl", device.value AS device, jsonb_build_object(
      'strategy', task."workResult"->'data'->device.value->'strategy',
      'score', task."workResult"->'data'->device.value->'score',
      'lcp', task."workResult"->'data'->device.value->'lcp',
      'cls', task."workResult"->'data'->device.value->'cls',
      'fcp', task."workResult"->'data'->device.value->'fcp',
      'tbt', task."workResult"->'data'->device.value->'tbt',
      'inp', task."workResult"->'data'->device.value->'inp',
      'measurement', task."workResult"->'data'->device.value->'diagnostics'->'measurement',
      'crux', task."workResult"->'data'->device.value->'crux') AS observation
    FROM audit_execution_tasks task CROSS JOIN (VALUES ('desktop'), ('mobile')) device(value)
    WHERE task."auditId" = ${audit.id} AND task."targetKey" LIKE 'task:%' AND task."workKind" = 'pagespeed'
      AND task."pageUrl" = task."workInput"->>'pageUrl'
      AND task."workState" IN ('COMPLETED', 'BLOCKED', 'EXHAUSTED')
      AND task."workResult"->>'kind' = 'pagespeed' AND task."workResult"->'version' = '1'::jsonb
      AND jsonb_typeof(task."workResult"->'data'->device.value) = 'object'
    ORDER BY task."createdAt", task."id", device.value LIMIT ${MAX_TASKS_PER_AUDIT * 2 + 1}`
  if (rows.length > MAX_TASKS_PER_AUDIT * 2) throw new TaskFailure('EXECUTION_TASK_LIMIT', false)
  const byPage = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const observed = byPage.get(row.pageUrl) ?? {}
    observed[row.device] ??= row.observation
    byPage.set(row.pageUrl, observed)
  }
  return derivePageSpeedCoverage(routes.map(route => ({ url: route.url, performanceData: byPage.get(route.url) ?? null })), { requireCurrentLab: true })
}
