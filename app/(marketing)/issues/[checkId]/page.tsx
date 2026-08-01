import { notFound } from 'next/navigation'
import type { Metadata, Route } from 'next'
import Link from 'next/link'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Heading, Lead, Muted, Body } from '@/components/ui/typography'
import { getIssuePage, MIN_SAMPLE_SIZE } from '@/lib/graph/queries'
import { getRelatedIssues } from '@/lib/graph/related'
import { issuePageSchema } from '@/lib/marketing/structured-data'
import {
  issuePageTitle,
  issuePageDescription,
  rubricLabel,
  rubricBadgeClasses,
} from '@/lib/marketing/issue-page'
import { SITE_URL } from '@/lib/marketing/copy'

interface Props {
  params: Promise<{ checkId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { checkId } = await params
  const data = await getIssuePage(checkId)
  if (!data) return { title: 'Not Found' }

  const title = issuePageTitle(data)
  const description = issuePageDescription(data)
  const url = `${SITE_URL}/issues/${checkId}`

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      type: 'article',
      url,
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export default async function IssuePage({ params }: Props) {
  const { checkId } = await params
  const data = await getIssuePage(checkId)

  if (!data) notFound()

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
                    Most affected frameworks
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
                        href={link.href as Route}
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

            {/* Methodology */}
            <Card variant="solid">
              <CardContent className="p-6 space-y-2">
                <Heading as="h2" className="text-lg">
                  About this data
                </Heading>
                <Muted>
                  This page is generated from FixFlags check data across{' '}
                  <strong className="text-foreground">{data.siteCount}</strong> distinct sites.
                  Sample sizes below {MIN_SAMPLE_SIZE} sites are excluded to maintain quality.
                  Data refreshes as new checks complete.
                </Muted>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="text-center space-y-3 pt-4 border-t border-border/30">
              <Body className="text-muted-foreground">
                Check if your site has this Flag.
              </Body>
              <Button asChild variant="default" size="lg">
                <Link href={`/?utm_source=issue&utm_medium=organic&utm_campaign=${checkId}`}>
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
