import { notFound } from 'next/navigation'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Heading, Lead, Muted, Body } from '@/components/ui/typography'
import { getIssuePage } from '@/lib/graph/queries'
import { getRelatedIssues } from '@/lib/graph/related'
import { issuePageSchema } from '@/lib/marketing/structured-data'
import { buildIssuePageMetadata } from '@/lib/marketing/metadata'
import {
  issuePageTitle,
  issuePageDescription,
  rubricLabel,
} from '@/lib/marketing/issue-page'
import { rubricBadgeClasses } from '@/lib/rubric-icons'
import { PUBLIC_RESEARCH_COPY } from '@/lib/marketing/copy/research'
import { publicResearchEntryHref, withCampaignTags, type CampaignQuery } from '@/lib/analytics/entry-surface'

interface Props {
  params: Promise<{ checkId: string }>
  searchParams?: Promise<CampaignQuery>
}

// Permission expiry must be checked on each request.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { checkId } = await params
  const data = await getIssuePage(checkId)
  if (!data) return { title: 'Not Found', robots: { index: false, follow: false } }

  const title = issuePageTitle(data)
  const description = issuePageDescription(data)

  return buildIssuePageMetadata({ checkId, title, description })
}

export default async function IssuePage({ params, searchParams }: Props) {
  const { checkId } = await params
  const data = await getIssuePage(checkId)

  if (!data) notFound()
  const campaign = await searchParams ?? {}

  const relatedIssues = await getRelatedIssues(checkId)

  const title = issuePageTitle(data)
  const description = issuePageDescription(data)
  const path = `/issues/${checkId}`
  const jsonLd = issuePageSchema({
    checkId,
    title,
    description,
    rubric: data.rubric,
    siteCount: data.siteCount,
    occurrenceCount: data.occurrenceCount,
    path,
    research: data.research,
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <Section spacing="marketing">
        <Container variant="content">
          <div className="space-y-10">
            {/* Hero */}
            <div className="text-center space-y-4">
              <Badge variant="outline" className={rubricBadgeClasses(data.rubric)}>
                {rubricLabel(data.rubric)}
              </Badge>
              <Heading as="h1" className="text-3xl sm:text-4xl font-bold text-foreground">
                {data.problemTemplate}
              </Heading>
              <Lead className="max-w-xl mx-auto text-muted-foreground">
                Observed on <strong className="text-foreground">{data.siteCount}</strong> reviewed
                sites ({data.occurrenceCount} total occurrences)
              </Lead>
            </div>

            <Card variant="solid">
              <CardContent className="p-6 space-y-3">
                <Heading as="h2" className="text-lg">{PUBLIC_RESEARCH_COPY.scopeTitle}</Heading>
                <Body className="text-muted-foreground">{data.research.methodology}</Body>
                <Muted>
                  {PUBLIC_RESEARCH_COPY.window(data.research.sampleSiteCount, data.research.windowStart, data.research.windowEnd)}
                </Muted>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {data.research.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
                </ul>
              </CardContent>
            </Card>

            {/* Fix */}
            <Card variant="solid">
              <CardContent className="p-6 space-y-3">
                <Heading as="h2" className="text-lg">
                  How to fix
                </Heading>
                <Body className="whitespace-pre-line text-muted-foreground">
                  {data.fixTemplate}
                </Body>
              </CardContent>
            </Card>

            {/* Top frameworks */}
            {data.topFrameworks.length > 0 && (
              <Card variant="solid">
                <CardContent className="p-6 space-y-3">
                  <Heading as="h2" className="text-lg">
                    Frameworks observed in this sample
                  </Heading>
                  <div className="flex flex-wrap gap-2">
                    {data.topFrameworks.map((fw) => (
                      <Badge key={fw.name} variant="secondary" size="md">
                        {fw.name} ({fw.siteCount} sites)
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Examples */}
            {data.examples.length > 0 && (
              <Card variant="solid">
                <CardContent className="p-6 space-y-4">
                  <Heading as="h2" className="text-lg">
                    What this looks like in the wild
                  </Heading>
                  <div className="space-y-3">
                    {data.examples.map((ex, i) => (
                      <div
                        key={`${ex.hostname}-${i}`}
                        className="flex items-center justify-between rounded-card border border-border/40 bg-background/50 px-4 py-3"
                      >
                        <div>
                          <span className="font-medium text-foreground">{ex.hostname}</span>
                          <span className="text-muted-foreground"> / {ex.pageRole}</span>
                        </div>
                        <Badge variant="outline" size="sm">
                          {ex.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related flags */}
            {relatedIssues.length > 0 && (
              <Card variant="solid">
                <CardContent className="p-6 space-y-4">
                  <Heading as="h2" className="text-lg">
                    Related flags
                  </Heading>
                  <div className="space-y-2">
                    {relatedIssues.map((link) => (
                      <Link
                        key={link.href}
                        href={withCampaignTags(link.href, campaign) as Route}
                        className="flex items-center justify-between gap-4 rounded-card border border-border/40 bg-background/50 px-4 py-3 transition-colors hover:border-border"
                      >
                        <div className="min-w-0">
                          <span className="block truncate font-medium text-foreground">
                            {link.title}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {link.reason}
                            {typeof link.siteCount === 'number' ? ` · ${link.siteCount} sites` : ''}
                          </span>
                        </div>
                        <span className="text-muted-foreground" aria-hidden>
                          →
                        </span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CTA */}
            <div className="text-center space-y-3 pt-4 border-t border-border/30">
              <Body className="text-muted-foreground">
                Check if your site has this Flag.
              </Body>
              <Button asChild variant="default" size="lg">
                <Link href={publicResearchEntryHref('issue_page', campaign) as Route}>
                  Run a free check
                </Link>
              </Button>
            </div>
          </div>
        </Container>
      </Section>
    </>
  )
}
