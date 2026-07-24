import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { Heading, LabelCaps, Muted, PageTitle } from '@/components/ui/typography'
import { getMadewithPage } from '@/lib/graph/queries'
import { MADE_WITH_COPY, SITE_URL } from '@/lib/marketing/copy'

interface Props {
  params: Promise<{ hostname: string }>
}

// Eligibility can change when a public share is revoked or an entitlement
// changes. Never freeze that decision into a static page.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hostname } = await params
  const data = await getMadewithPage(hostname)
  if (!data) return { title: 'Not found', robots: { index: false, follow: false } }

  const names = data.technologyProfile.technologies.map((technology) => technology.name)
  const title = MADE_WITH_COPY.metaTitle(data.hostname, names)
  const description = MADE_WITH_COPY.metaDescription(data.hostname)
  const canonical = `${SITE_URL.replace(/\/$/, '')}/madewith/${data.hostname}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, type: 'website', url: canonical },
  }
}

export default async function MadewithPage({ params }: Props) {
  const { hostname } = await params
  const data = await getMadewithPage(hostname)
  if (!data) notFound()

  return (
    <Container variant="default" className="space-y-8 py-14 sm:py-20">
      <header className="max-w-3xl">
        <LabelCaps>{MADE_WITH_COPY.publicProfileLabel}</LabelCaps>
        <PageTitle className="mt-3">{data.hostname}</PageTitle>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
          {MADE_WITH_COPY.publicProfileLead}
        </p>
      </header>

      <MadeWithProfile profile={data.technologyProfile} />

      <Card>
        <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <p className="section-label mb-2">{MADE_WITH_COPY.latestPublicReport}</p>
            <Heading as="h2" className="text-xl sm:text-2xl">
              {MADE_WITH_COPY.reportSummary(data.lastAudit.score, data.lastAudit.flagCount)}
            </Heading>
            <Muted className="mt-2">
              {MADE_WITH_COPY.completed}{' '}
              {data.lastAudit.completedAt.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Muted>
          </div>
          <Button asChild>
            <Link href={`/report/${data.lastAudit.id}`}>{MADE_WITH_COPY.openPublicReport}</Link>
          </Button>
        </CardContent>
      </Card>

      {data.relatedSites.length > 0 ? (
        <section aria-labelledby="related-stack-title">
          <Heading as="h2" id="related-stack-title" className="text-xl sm:text-2xl">
            {MADE_WITH_COPY.relatedProfiles}
          </Heading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {data.relatedSites.map((site) => (
              <Link
                key={site.hostname}
                href={`/madewith/${site.hostname}`}
                className="rounded-card bg-card/60 p-5 shadow-card outline-none transition-shadow duration-200 hover:shadow-card-hover focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2"
              >
                <p className="font-medium text-foreground">{site.hostname}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {site.techNames.join(' · ')}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col items-start gap-3 rounded-card bg-muted/35 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <p className="text-sm text-muted-foreground">
          {MADE_WITH_COPY.ownSitePrompt}
        </p>
        <Button asChild variant="outline">
          <Link href={`/?url=${encodeURIComponent(data.rootUrl)}`}>{MADE_WITH_COPY.checkAgain}</Link>
        </Button>
      </div>
    </Container>
  )
}
