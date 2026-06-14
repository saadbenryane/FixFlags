import Link from 'next/link'
import { Suspense } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading } from '@/components/ui/typography'
import { ExamplesFilterBar, type ExampleTagId } from '@/components/marketing/ExamplesFilterBar'
import { ExampleAuditCard } from '@/components/marketing/ExampleAuditCard'
import { EXAMPLE_AUDITS } from '@/lib/marketing/example-audits'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { LighthouseCallout } from '@/components/marketing/LighthouseCallout'
import { Badge } from '@/components/ui/badge'
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
    <Section spacing="default">
      <Container variant="report" className="space-y-8">
        <div className="space-y-3">
          <Badge variant="secondary">Example audits</Badge>
          <Heading as="h1">Example audits from recognizable sites</Heading>
          <Body className="max-w-2xl text-muted-foreground">
            Representative audits illustrating QualityOS pipeline v{PIPELINE_VERSION} output.
            Results are context-dependent — every site has unique constraints and tradeoffs. These
            are not endorsements or partnerships.
          </Body>
          <LighthouseCallout className="max-w-2xl text-sm text-muted-foreground" />
        </div>

        <Suspense fallback={null}>
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

        <ThirdPartyAuditDisclaimer />

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
