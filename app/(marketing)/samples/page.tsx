import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { HeroProductPreview } from '@/components/marketing/landing/HeroProductPreview'
import { DevSampleMetaLogger } from '@/components/marketing/DevSampleMetaLogger'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'

export const metadata = buildPageMetadata('samples', '/samples')

export default async function SamplesPage() {
  const sample = await getLiveSampleAudit()
  const model = buildSampleExplorerModel(buildSampleReportDisplay(sample.audit))

  return (
    <Section spacing="report">
      <DevSampleMetaLogger
        source={sample.source}
        completedAt={sample.completedAt}
        pipelineVersion={sample.pipelineVersion}
        isDemoFixture
        isDogfood={false}
      />
      <Container className="space-y-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="section-label">{REPORT_COPY.sampleFocused.eyebrow}</p>
          <h1 className="mt-3 text-balance font-serif text-3xl font-medium tracking-display sm:text-5xl">
            {REPORT_COPY.sampleFocused.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
            {REPORT_COPY.sampleFocused.body}
          </p>
        </header>
        <HeroProductPreview model={model} />
        <div className="flex justify-center">
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/samples/details">
              {REPORT_COPY.sampleFocused.detailsCta}
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
