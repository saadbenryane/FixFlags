import Link from 'next/link'
import { AuditReport } from '@/components/audit/AuditReport'
import { SampleStatusBadge } from '@/components/marketing/SampleStatusBadge'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Body } from '@/components/ui/typography'
import { SAMPLES_PAGE } from '@/lib/marketing/copy'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getLiveSampleAudit } from '@/lib/marketing/live-sample'
import { HERO_FIX_PROMPT } from '@/lib/marketing/copy'

export const metadata = buildPageMetadata('samples', '/samples')

export default async function SamplesPage() {
  const sample = await getLiveSampleAudit()

  if (!sample.audit) {
    return (
      <Container className="max-w-2xl space-y-5 py-24 text-center">
        <SampleStatusBadge source={sample.source} pipelineVersion={sample.pipelineVersion} />
        <h1 className="font-display text-4xl tracking-display">No published report yet.</h1>
        <Body className="text-muted-foreground">
          Run an audit on your site, or wait for the pipeline to publish a new first-party sample.
          Here is an example of what you get:
        </Body>
        <div className="rounded-lg border bg-muted/30 p-4 text-left space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            {HERO_FIX_PROMPT.label}
          </p>
          <p className="text-sm font-medium">{HERO_FIX_PROMPT.finding}</p>
          <p className="text-sm text-muted-foreground">{HERO_FIX_PROMPT.prompt}</p>
        </div>
        <Button asChild><Link href="/">Run audit</Link></Button>
      </Container>
    )
  }

  const disclaimer =
    sample.source === 'archived'
      ? 'This is the last published sample — a newer live sample may be regenerating.'
      : SAMPLES_PAGE.tierNote

  return (
    <>
      <Container className="max-w-4xl pt-8 pb-2">
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
        </div>
      </Container>

      <AuditReport
        audit={sample.audit}
        viewerIsPaid={false}
        isLoggedIn={false}
        variant="sample"
      />

      <Container className="max-w-4xl pb-12 text-center">
        <Button asChild size="lg">
          <Link href="/">{SAMPLES_PAGE.bottomCta}</Link>
        </Button>
      </Container>
    </>
  )
}
