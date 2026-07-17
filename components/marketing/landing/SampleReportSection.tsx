import { HeroProductPreview } from '@/components/marketing/landing/HeroProductPreview'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import {
  SampleSectionCta,
  SampleViewTracker,
} from '@/components/marketing/landing/SampleFunnelEvents'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import { LANDING_PAGE } from '@/lib/marketing/copy'

interface SampleReportSectionProps {
  audit?: LiveSampleAudit
  /** When true, show the illustrative-scores disclosure on the explorer. */
  illustrative?: boolean
}

export function SampleReportSection({ audit, illustrative = false }: SampleReportSectionProps) {
  const { label, headline, body, illustrativeLabel } = LANDING_PAGE.sampleReport

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
            <p className="mx-auto mt-2 text-center font-mono text-[11px] uppercase tracking-label text-muted-foreground/80">
              {illustrativeLabel}
            </p>
          ) : null}
        </RevealOnView>

        <div className="relative motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:forwards]">
          <HeroProductPreview audit={audit} />
        </div>

        <SampleSectionCta />
      </Container>
    </Section>
  )
}
