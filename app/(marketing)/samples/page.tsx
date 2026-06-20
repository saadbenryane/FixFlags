import Link from 'next/link'
import { SampleReportExplorer } from '@/components/marketing/sample/SampleReportExplorer'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { LighthouseCallout } from '@/components/marketing/LighthouseCallout'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { HERO, REPORT_COPY, SAMPLES_PAGE } from '@/lib/marketing/copy'
import { getSampleSiteDisplay } from '@/lib/marketing/display-meta'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'

export const metadata = buildPageMetadata('samples', '/samples')
export const dynamic = 'force-dynamic'

export default async function SamplesPage() {
  const sample = await getLiveSampleAudit()
  const site = getSampleSiteDisplay(sample.audit.url)
  const report = buildSampleReportDisplay(sample.audit)

  const statusNote =
    sample.source === 'archived'
      ? 'Last published sample. A newer live sample may be regenerating.'
      : SAMPLES_PAGE.tierNote

  const affiliationNote = site.isDogfood
    ? 'Sample report of fixflags.com. Automated and illustrative.'
    : `Not affiliated with ${site.displayHost}. Automated audit for illustration only.`

  return (
    <Section spacing="marketing">
      <Container variant="report" className="pt-8 pb-2">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <SampleStatusBadge
              source={sample.source}
              completedAt={sample.completedAt}
              pipelineVersion={sample.pipelineVersion}
            />
          </div>
          <Body className="text-sm text-muted-foreground">{SAMPLES_PAGE.subhead}</Body>
          <Body className="text-xs text-muted-foreground">{statusNote}</Body>
          <Body className="text-xs text-muted-foreground">{affiliationNote}</Body>
          <ThirdPartyAuditDisclaimer variant="compact" />
          <LighthouseCallout className="text-xs text-muted-foreground" />
        </div>
      </Container>

      <Container variant="report">
        <SampleReportExplorer report={report} />
      </Container>

      <Container variant="report" className="pb-12 pt-8">
        <div className="rounded-card glass-surface p-6 text-center shadow-card sm:p-8">
          <h2 className="text-xl font-semibold text-balance">{REPORT_COPY.sampleCta.title}</h2>
          <p className="mx-auto mt-2 max-w-prose text-sm text-muted-foreground text-pretty">
            {REPORT_COPY.sampleCta.body}
          </p>
          <Button asChild className="mt-5">
            <Link href="/#audit">{HERO.primaryCta}</Link>
          </Button>
        </div>
      </Container>
    </Section>
  )
}
