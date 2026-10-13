import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'

interface CountRow {
  id: string
  occurrence_count: bigint
  site_count: bigint
  framework_count: bigint
}

export const ISSUE_AGGREGATES_SQL = Prisma.sql`
    SELECT
      i."checkId" AS id,
      COUNT(DISTINCT io.id)::bigint AS occurrence_count,
      COUNT(DISTINCT io."siteId")::bigint AS site_count,
      COUNT(DISTINCT t.id)::bigint AS framework_count
    FROM "graph_issue" i
    LEFT JOIN "graph_issue_occurrence" io ON io."issueId" = i.id
    LEFT JOIN "graph_site_technology" st
      ON st."siteId" = io."siteId" AND st."isCurrent" = true
    LEFT JOIN "graph_technology" t
      ON t.id = st."technologyId" AND t.kind = 'framework'
    GROUP BY i."checkId"
  `

async function recomputeIssueAggregates(): Promise<number> {
  const checkRows = await prisma.$queryRaw<CountRow[]>(ISSUE_AGGREGATES_SQL)

  for (const row of checkRows) {
    await prisma.issue.updateMany({
      where: { checkId: row.id },
      data: {
        occurrenceCount: Number(row.occurrence_count),
        siteCount: Number(row.site_count),
        frameworkCount: Number(row.framework_count),
      },
    })
  }
  return checkRows.length
}

export async function runIssueRollup(): Promise<{ issues: number; examples: number }> {
  const issues = await recomputeIssueAggregates()
  // Removing www does not anonymize a hostname. No permitted example release exists.
  await prisma.issue.updateMany({ data: { examples: [] } })
  return { issues, examples: 0 }
}
