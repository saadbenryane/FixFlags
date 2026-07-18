import dynamic from 'next/dynamic'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import {
  SampleSectionCta,
  SampleViewTracker,
} from '@/components/marketing/landing/SampleFunnelEvents'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'

const HeroProductPreview = dynamic(
  () =>
    import('@/components/marketing/landing/HeroProductPreview').then(
      (m) => m.HeroProductPreview
    ),
  {
    ssr: true,
    loading: () => (
      <div
        aria-hidden
        className="mx-auto aspect-[16/10] w-full max-w-5xl animate-pulse rounded-card bg-muted/40 shadow-card"
      />
    ),
  }
)

interface SampleReportSectionProps {
  audit?: LiveSampleAudit
  /** When true, show the illustrative-scores disclosure on the explorer. */
  illustrative?: boolean
}

export function SampleReportSection({ audit, illustrative = false }: SampleReportSectionProps) {
  const { label, headline, body, illustrativeLabel } = LANDING_PAGE.sampleReport
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit())
  const model = buildSampleExplorerModel(report)

  return (
    <Section spacing="marketing" id="sample-review" className="scroll-mt-[var(--header-offset)]">
      <SampleViewTracker placement="homepage" />
      <Container className="space-y-8 sm:space-y-11">
        <RevealOnView>
          <LandingSectionHeader label={label} headline={headline} showLabel />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-center text-base leading-relaxed text-muted-foreground">
            {body}
          </p>
          {illustrative ? (
            <p className="mx-auto mt-2 text-center section-label">
              {illustrativeLabel}
            </p>
          ) : null}
        </RevealOnView>

        <div className="relative motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:forwards]">
          <HeroProductPreview model={model} />
        </div>

        <SampleSectionCta />
      </Container>
    </Section>
  )
}
