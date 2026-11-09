import { Prisma } from '@prisma/client'

export const MONITORING_SETUP_RETRY_MS = 60_000
/** A URL that cannot be checked is not due every minute. Recheck it daily so a
 * corrected public URL can still receive a monitor. */
export const MONITORING_SETUP_UNAVAILABLE_RETRY_MS = 24 * 60 * 60 * 1000

type SetupRetryField = 'monitoringSetupRetryAt' | 'uptimeSetupRetryAt'
export type MonitoringSetupSite = { id: string; userId: string; url: string; retryAt: Date | null }
const MONITORING_SETUP_CONCURRENCY = 4

/** Bound setup transactions while keeping any shared authority lane ordered. */
export async function runMonitoringSetup(sites: MonitoringSetupSite[], setup: (site: MonitoringSetupSite) => Promise<void>,
  lane: (site: MonitoringSetupSite) => string) {
  const lanes = Map.groupBy(sites, lane)
  const pending = lanes.values()
  await Promise.all(Array.from({ length: Math.min(MONITORING_SETUP_CONCURRENCY, lanes.size) }, async () => {
    for (const laneSites of pending) {
      for (const site of laneSites) await setup(site)
    }
  }))
}

const retryColumns = {
  monitoringSetupRetryAt: Prisma.sql`p."monitoringSetupRetryAt"`,
  uptimeSetupRetryAt: Prisma.sql`p."uptimeSetupRetryAt"`,
}

/** Skip busy rows before applying the limit. Reusing the query in a write
 * transaction retains the selected Site and owner through that write. */
export function selectMonitoringSetupSites(db: Prisma.TransactionClient, field: SetupRetryField, eligible: Prisma.Sql,
  now: Date, limit: number, scope?: Partial<MonitoringSetupSite>) {
  const retry = retryColumns[field]
  return db.$queryRaw<MonitoringSetupSite[]>(Prisma.sql`
    SELECT p.id, p."userId", p.url, ${retry} AS "retryAt"
    FROM projects p JOIN users u ON u.id = p."userId"
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND p."watchPausedAt" IS NULL
      AND (${retry} IS NULL OR ${retry} <= ${now}) AND (${eligible})
      ${scope?.id !== undefined ? Prisma.sql`AND p.id = ${scope.id}` : Prisma.empty}
      ${scope?.userId !== undefined ? Prisma.sql`AND p."userId" = ${scope.userId}` : Prisma.empty}
      ${scope?.url !== undefined ? Prisma.sql`AND p.url = ${scope.url}` : Prisma.empty}
      ${scope?.retryAt !== undefined ? Prisma.sql`AND ${retry} IS NOT DISTINCT FROM ${scope.retryAt}` : Prisma.empty}
    ORDER BY ${retry} ASC NULLS FIRST, p."createdAt" ASC, p.id ASC
    LIMIT ${limit} FOR NO KEY UPDATE OF p SKIP LOCKED FOR SHARE OF u SKIP LOCKED`)
}

/** Called while holding the selected Site's setup lock. */
export function deferMonitoringSetup(db: Prisma.TransactionClient, field: SetupRetryField, projectId: string, now: Date,
  delayMs = MONITORING_SETUP_RETRY_MS) {
  return db.project.updateMany({ where: { id: projectId }, data: { [field]: new Date(now.getTime() + delayMs) } })
}
