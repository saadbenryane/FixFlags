import Link from 'next/link'
import { Suspense } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { ExamplesFilterBar, type ExampleTagId } from '@/components/marketing/ExamplesFilterBar'
import { ExampleAuditCard } from '@/components/marketing/ExampleAuditCard'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { EXAMPLE_AUDITS } from '@/lib/marketing/example-audits'
import { EXAMPLES_PAGE } from '@/lib/marketing/copy'
import { LighthouseNote } from '@/components/marketing/LighthouseNote'
import { buildPageMetadata } from '@/lib/marketing/metadata'

export const metadata = buildPageMetadata('examples', '/examples')

const VALID_TAGS: ExampleTagId[] = [
  'all',
  'best-practices',
  'marketing',
  'content-heavy',
  'agency-ready',
]

function filterAudits(tag: ExampleTagId) {
  if (tag === 'all') return EXAMPLE_AUDITS
  return EXAMPLE_AUDITS.filter((audit) => audit.tags.includes(tag))
}

export default async function ExamplesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string }>
}) {
  const params = await searchParams
  const rawTag = params.tag ?? 'all'
  const tag = VALID_TAGS.includes(rawTag as ExampleTagId) ? (rawTag as ExampleTagId) : 'all'
  const audits = filterAudits(tag)

  return (
    <Section spacing="marketing">
      <Container variant="report" className="space-y-10 sm:space-y-12">
        <div className="mx-auto max-w-3xl space-y-4">
          <LandingSectionHeader
            label={EXAMPLES_PAGE.label}
            headline={EXAMPLES_PAGE.headline}
            as="h1"
          />
          <Body className="text-muted-foreground text-pretty">
            {EXAMPLES_PAGE.body}
          </Body>
          <LighthouseNote className="text-sm text-muted-foreground" />
        </div>

        <Suspense
          fallback={
            <div
              className="h-11 w-full animate-pulse rounded-control bg-muted/45 sm:w-96"
              role="status"
              aria-label="Loading example filters"
            />
          }
        >
          <ExamplesFilterBar activeTag={tag} />
        </Suspense>

        <div className="space-y-12">
          {audits.map((audit) => (
            <ExampleAuditCard key={audit.id} audit={audit} />
          ))}
          {audits.length === 0 && (
            <p className="text-sm text-muted-foreground">No examples match this filter.</p>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-4">
          <Button variant="outline" asChild>
            <Link href="/samples">
              View live sample
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
