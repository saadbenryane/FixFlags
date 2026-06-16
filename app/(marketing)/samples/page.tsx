import { AuditReport } from '@/components/audit/AuditReport'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { LighthouseCallout } from '@/components/marketing/LighthouseCallout'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body } from '@/components/ui/typography'
import { SAMPLES_PAGE } from '@/lib/marketing/copy'
import { getSampleSiteDisplay } from '@/lib/marketing/display-meta'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'

export const metadata = buildPageMetadata('samples', '/samples')
export const dynamic = 'force-dynamic'

export default async function SamplesPage() {
  const sample = await getLiveSampleAudit()
  const site = getSampleSiteDisplay(sample.audit.url)

  const statusNote =
    sample.source === 'archived'
      ? 'Last published sample. A newer live sample may be regenerating.'
      : SAMPLES_PAGE.tierNote

  const affiliationNote = site.isDogfood
    ? 'Sample report of fixflags.com. Automated and illustrative.'
    : `Not affiliated with ${site.displayHost}. Automated audit for illustration only.`

  return (
    <Section spacing="default">
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

      <AuditReport
        audit={sample.audit}
        viewerIsPaid={false}
        isLoggedIn={false}
        variant="sample"
      />
    </Section>
  )
}
