import { prisma } from '@/lib/db'

interface CountRow {
  id: string
  occurrence_count: bigint
  site_count: bigint
  framework_count: bigint
}

async function recomputeIssueAggregates(): Promise<number> {
  const checkRows = await prisma.$queryRaw<CountRow[]>`
    SELECT
      i."checkId" AS id,
      COUNT(io.id)::bigint AS occurrence_count,
      COUNT(DISTINCT io."siteId")::bigint AS site_count,
      COUNT(DISTINCT st."technologyId")::bigint AS framework_count
    FROM "graph_issue" i
    LEFT JOIN "graph_issue_occurrence" io ON io."issueId" = i.id
    LEFT JOIN "graph_site_technology" st ON st."siteId" = io."siteId"
    GROUP BY i."checkId"
  `

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

async function rebuildExamples(): Promise<number> {
  const checkIds = await prisma.issue.groupBy({ by: ['checkId'] })

  for (const { checkId } of checkIds) {
    const examples = await prisma.$queryRaw<
      Array<{ hostname: string; pageRole: string; severity: string }>
    >`
      SELECT s.hostname AS hostname,
             COALESCE(p.role, 'other') AS "pageRole",
             f.severity AS severity
      FROM "graph_issue_occurrence" io
      JOIN "graph_issue" i ON i.id = io."issueId"
      JOIN "graph_site" s ON s.id = io."siteId"
      JOIN "flags" f ON f.id = io."flagId"
      LEFT JOIN "graph_page" p
        ON p."siteId" = s.id AND p.url = f."pageUrl"
      WHERE i."checkId" = ${checkId}
      ORDER BY io."observedAt" DESC
      LIMIT 3
    `
    await prisma.issue.updateMany({
      where: { checkId },
      data: {
        examples: examples.map((example) => ({
          hostname: example.hostname.replace(/^www\./, ''),
          pageRole: example.pageRole,
          severity: example.severity,
        })),
      },
    })
  }
  return checkIds.length
}

export async function runIssueRollup(): Promise<{ issues: number; examples: number }> {
  const issues = await recomputeIssueAggregates()
  const examples = await rebuildExamples()
  return { issues, examples }
}
