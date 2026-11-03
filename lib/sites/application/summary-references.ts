import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { claimedSiteWideAnalysisSourceSql } from './analysis-scope'

type SiteSummaryReference = {
  projectId: string
  latestAuditId: string | null
  completedAuditId: string | null
  screenshotId: string | null
}

/** Select summary sources before loading evidence. ORM distinct and relation
 * take can trim multi-parent history after transferring it from PostgreSQL. */
export function loadSiteSummaryReferences(projectIds: string[]): Promise<SiteSummaryReference[]> {
  if (!projectIds.length) return Promise.resolve([])
  return prisma.$queryRaw<SiteSummaryReference[]>(Prisma.sql`
    SELECT requested.id AS "projectId", latest.id AS "latestAuditId",
      completed.id AS "completedAuditId",
      (SELECT shot.id FROM screenshots shot
        WHERE shot."auditId" = COALESCE(latest.id, completed.id) AND shot.device = 'DESKTOP'
        ORDER BY shot.id DESC LIMIT 1) AS "screenshotId"
    FROM (VALUES ${Prisma.join(projectIds.map(id => Prisma.sql`(${id}::text)`))}) requested(id)
    LEFT JOIN LATERAL (
      SELECT source.id FROM audits source
      WHERE source."projectId" = requested.id AND ${claimedSiteWideAnalysisSourceSql}
      ORDER BY source."createdAt" DESC LIMIT 1
    ) latest ON TRUE
    LEFT JOIN LATERAL (
      SELECT source.id FROM audits source
      WHERE source."projectId" = requested.id AND source.status = 'COMPLETED'
        AND ${claimedSiteWideAnalysisSourceSql}
      ORDER BY source."completedAt" DESC LIMIT 1
    ) completed ON TRUE
  `)
}
