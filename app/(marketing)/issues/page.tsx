import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heading, Lead, Muted } from '@/components/ui/typography'
import { getIndexableIssueCheckIds, MIN_SAMPLE_SIZE } from '@/lib/graph/queries'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { prisma } from '@/lib/db'

export const metadata = buildPageMetadata('issues', '/issues')
// This library is a live projection of the PostgreSQL knowledge graph.
export const dynamic = 'force-dynamic'

export default async function IssuesIndexPage() {
  const issues = await getIndexableIssueCheckIds()

  const checkIds = issues.map((i) => i.checkId)

  const issuesWithMeta =
    checkIds.length > 0
      ? await prisma.issue.findMany({
          where: { checkId: { in: checkIds } },
          distinct: ['checkId'],
          orderBy: { siteCount: 'desc' },
          select: {
            checkId: true,
            rubric: true,
            problemTemplate: true,
            siteCount: true,
            occurrenceCount: true,
          },
        })
      : []

  const rubricColor = (rubric: string) => {
    if (rubric === 'MESSAGE') return 'bg-brand-muted text-brand border-brand-border'
    if (rubric === 'EXPERIENCE') return 'bg-warning-muted text-warning-foreground border-warning-border'
    return 'bg-success-muted text-success border-success-border'
  }

  return (
    <Section spacing="marketing">
      <Container variant="default">
        <div className="space-y-8 sm:space-y-10">
          <div className="text-center space-y-3">
            <Heading as="h1" className="text-3xl sm:text-4xl font-bold">
              Issue Library
            </Heading>
            <Lead className="max-w-xl mx-auto text-muted-foreground">
              Real issues found across {issues.length > 0 ? issuesWithMeta[0]?.siteCount ?? MIN_SAMPLE_SIZE : MIN_SAMPLE_SIZE}+
              audited sites. Each page shows frequency, affected frameworks, anonymized examples, and a fix.
            </Lead>
          </div>

          {issuesWithMeta.length === 0 ? (
            <div className="text-center py-12">
              <Muted>
                No issues have crossed the sample-size threshold yet.
                We need data from at least {MIN_SAMPLE_SIZE} audited sites per issue.
              </Muted>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {issuesWithMeta.map((issue) => (
                <Link
                  key={issue.checkId}
                  href={`/issues/${issue.checkId}?utm_source=issue_index&utm_medium=organic&utm_campaign=${issue.checkId}`}
                >
                  <Card variant="solid" interactive className="h-full">
                    <CardContent className="p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" size="sm" className={rubricColor(issue.rubric)}>
                          {issue.rubric}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {issue.siteCount} sites
                        </span>
                      </div>
                      <Heading as="h2" className="text-base leading-snug">
                        {issue.problemTemplate}
                      </Heading>
                      <Muted className="text-xs">
                        {issue.occurrenceCount} occurrences across {issue.siteCount} sites
                      </Muted>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </Container>
    </Section>
  )
}
