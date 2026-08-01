import { prisma } from '@/lib/db'
import { MIN_SAMPLE_SIZE } from './queries'
import { rubricLabel } from '@/lib/marketing/issue-page'

export interface RelatedLink {
  type: 'issue' | 'tool' | 'benchmark'
  href: string
  title: string
  reason: string
  siteCount?: number
}

export async function getRelatedIssues(checkId: string): Promise<RelatedLink[]> {
  const current = await prisma.issue.findFirst({
    where: { checkId },
    orderBy: { siteCount: 'desc' },
    select: { rubric: true, id: true },
  })
  if (!current) return []

  const sameRubric = await prisma.issue.findMany({
    where: {
      rubric: current.rubric,
      checkId: { not: checkId },
      siteCount: { gte: MIN_SAMPLE_SIZE },
    },
    orderBy: { siteCount: 'desc' },
    take: 3,
    select: { checkId: true, problemTemplate: true, siteCount: true },
  })

  const label = rubricLabel(current.rubric)

  const links: RelatedLink[] = sameRubric.map((i) => ({
    type: 'issue' as const,
    href: `/issues/${i.checkId}`,
    title: i.problemTemplate,
    reason: `Same ${label} rubric`,
    siteCount: i.siteCount,
  }))

  if (links.length < 3) {
    const frameworkRows = await prisma.$queryRaw<
      Array<{ checkId: string; problemTemplate: string; siteCount: number }>
    >`
      SELECT DISTINCT ON (i."checkId")
             i."checkId" AS "checkId",
             i."problemTemplate" AS "problemTemplate",
             i."siteCount" AS "siteCount"
      FROM "graph_issue" i
      JOIN "graph_issue_occurrence" io ON io."issueId" = i.id
      JOIN "graph_site_technology" st ON st."siteId" = io."siteId"
      WHERE st."isCurrent" = true
        AND i."checkId" != ${checkId}
        AND i."siteCount" >= ${MIN_SAMPLE_SIZE}
        AND st."technologyId" IN (
          SELECT st2."technologyId"
          FROM "graph_issue_occurrence" io2
          JOIN "graph_issue" i2 ON i2.id = io2."issueId"
          JOIN "graph_site_technology" st2 ON st2."siteId" = io2."siteId"
          WHERE i2."checkId" = ${checkId}
            AND st2."isCurrent" = true
        )
      ORDER BY i."checkId", i."siteCount" DESC
      LIMIT ${3 - links.length}
    `

    for (const row of frameworkRows) {
      if (!links.some((l) => l.href === `/issues/${row.checkId}`)) {
        links.push({
          type: 'issue',
          href: `/issues/${row.checkId}`,
          title: row.problemTemplate,
          reason: 'Shared technology stack',
          siteCount: row.siteCount,
        })
      }
    }
  }

  return links
}
