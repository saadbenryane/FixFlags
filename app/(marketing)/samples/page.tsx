import { MarketingPageViewTracker } from '@/components/marketing/MarketingPageViewTracker'
import { AuditReport } from '@/components/audit/AuditReport'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { buildPageMetadata } from '@/lib/marketing/metadata'
import { getCuratedSampleAudit } from '@/lib/marketing/curated-sample'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { buildFixFlagsScanMessages } from '@/lib/audit/scan-agent-messages'
import { DEMO_BRAND } from '@/lib/demo/brand'
import { REPORT_COPY } from '@/lib/marketing/copy'

export const metadata = buildPageMetadata('samples', '/samples')

export default async function SamplesPage() {
  const { audit } = await getCuratedSampleAudit()
  const display = buildSampleReportDisplay(audit)
  // The curated sample demonstrates exactly one fix prompt.
  const sampleFixFlag =
    audit.flags.find((flag) => flag.id === display.demonstratedFlagId) ?? null
  // Deterministic transcript of the curated run. No scan is started here.
  const agentMessages = buildFixFlagsScanMessages({
    id: audit.id,
    status: 'COMPLETED',
    progress: 100,
    startedAt: audit.startedAt,
    completedAt: audit.completedAt,
    reportCompleteness: audit.reportCompleteness,
    screenshotCapture: audit.screenshotCapture,
    journeyReviewIncluded: (audit.actionTimeline?.length ?? 0) > 0,
    journeyReviewAt: audit.completedAt,
    flags: audit.flags.map((flag) => ({
      id: flag.id,
      problem: flag.problem,
      rubric: flag.rubric,
    })),
  })

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
        <div className="h-[min(calc(100dvh-16rem),54rem)] overflow-hidden rounded-card bg-background shadow-glass-deep ring-1 ring-border/55">
          <AuditReport
            audit={audit}
            variant="sample"
            viewerIsPaid={false}
            isLoggedIn={false}
            isViewerOwner={false}
            productName={DEMO_BRAND.displayLabel}
            sampleFixFlag={sampleFixFlag}
            scoreHistory={audit.scoreHistory}
            agentMessages={agentMessages}
          />
        </div>
      </Container>
    </Section>
  )
}
