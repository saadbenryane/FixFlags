import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { ReportWorkspace } from '@/components/report/ReportWorkspace'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getCuratedSampleAudit } from '@/lib/marketing/curated-sample'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { HERO, REPORT_COPY } from '@/lib/marketing/copy'
import { buildCuratedSampleWorkspaceModel } from '@/lib/report/workspace-adapters'
import Link from 'next/link'

export const metadata = buildPageMetadata('samples', '/samples')

export default async function SamplesPage() {
  const sample = await getCuratedSampleAudit()
  const model = buildCuratedSampleWorkspaceModel(buildSampleReportDisplay(sample.audit))

  return (
    <Section spacing="report">
      <MarketingPageViewTracker page="/samples" />
      <Container variant="report" className="space-y-8">
        <header className="mx-auto max-w-3xl text-center">
          <p className="section-label">{REPORT_COPY.sampleFocused.eyebrow}</p>
          <h1 className="mt-3 text-balance font-display text-3xl font-semibold tracking-display sm:text-5xl">
            {REPORT_COPY.sampleFocused.title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-balance text-muted-foreground">
            {REPORT_COPY.sampleFocused.body}
          </p>
        </header>
        <ReportWorkspace
          model={model}
          actions={
            <Button asChild variant="brand">
              <Link href="/#audit">{HERO.primaryCta}</Link>
            </Button>
          }
          signUpHref="/sign-up?from=sample"
          className="rounded-card bg-background/80 p-4 shadow-glass-deep glass-surface sm:p-6"
        />
      </Container>
    </Section>
  )
}
