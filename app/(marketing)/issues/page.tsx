import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Heading, Lead, Muted } from '@/components/ui/typography'
import { getIndexableIssueCheckIds, MIN_SAMPLE_SIZE } from '@/lib/graph/queries'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { issueIndexStructuredData } from '@/lib/marketing/structured-data'
import { humanizeCheckId } from '@/lib/marketing/issue-page'
import { rubricBadgeClasses } from '@/lib/rubric-icons'
import { prisma } from '@/lib/db'
import { FLAG_LIBRARY } from '@/lib/marketing/copy/library'

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

  const issueIndexJsonLd = issueIndexStructuredData(
    issuesWithMeta.map((issue) => ({
      checkId: issue.checkId,
      title: issue.problemTemplate || humanizeCheckId(issue.checkId),
    }))
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(issueIndexJsonLd) }}
      />
      <Section spacing="marketing">
      <Container variant="default">
        <main className="space-y-8 sm:space-y-10">
          <div className="text-center space-y-3">
            <Heading as="h1" className="text-3xl sm:text-4xl font-bold">
              {FLAG_LIBRARY.title}
            </Heading>
            <Lead className="max-w-xl mx-auto text-muted-foreground">
              {FLAG_LIBRARY.body}
            </Lead>
          </div>

          {issuesWithMeta.length === 0 ? (
            <div className="space-y-4 text-center py-12">
              <Heading as="h2" className="text-xl">{FLAG_LIBRARY.emptyTitle}</Heading>
              <Muted>
                {FLAG_LIBRARY.emptyBody(MIN_SAMPLE_SIZE)}
              </Muted>
              <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium">
                <Link href="/docs/site-care" className="inline-flex min-h-11 items-center text-link hover:underline">{FLAG_LIBRARY.docsCta}</Link>
                <Link href="/new" className="inline-flex min-h-11 items-center text-link hover:underline">{FLAG_LIBRARY.startCta}</Link>
              </div>
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
                        <Badge variant="outline" size="sm" className={rubricBadgeClasses(issue.rubric)}>
                          {issue.rubric}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {issue.siteCount} sites
                        </span>
                      </div>
                      <Heading as="h2" className="text-base leading-snug">
                        {issue.problemTemplate || humanizeCheckId(issue.checkId)}
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
        </main>
      </Container>
    </Section>
    </>
  )
}
