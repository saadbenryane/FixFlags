import { AuditReport } from '@/components/audit/AuditReport'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { LighthouseCallout } from '@/components/marketing/LighthouseCallout'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { Container } from '@/components/ui/container'
import { Body } from '@/components/ui/typography'
import { SAMPLES_PAGE } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'

export const metadata = buildPageMetadata('samples', '/samples')

export default async function SamplesPage() {
  const sample = await getLiveSampleAudit()

  const disclaimer =
    sample.source === 'archived'
      ? 'This is the last published sample — a newer live sample may be regenerating.'
      : SAMPLES_PAGE.tierNote

  return (
    <>
      <Container variant="report" className="pt-8 pb-2">
        <div className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <SampleStatusBadge
              source={sample.source}
              completedAt={sample.completedAt}
              pipelineVersion={sample.pipelineVersion}
            />
            <Body className="text-muted-foreground text-sm">{SAMPLES_PAGE.subhead}</Body>
          </div>
          <Body className="text-muted-foreground text-xs">{disclaimer}</Body>
          <Body className="text-muted-foreground text-xs">
            Not affiliated with {new URL(sample.audit.url).hostname}. Automated audit for
            illustration only.
          </Body>
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
    </>
  )
}
