import { HeroProductPreview } from '@/components/marketing/landing/HeroProductPreview'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import { LANDING_PAGE } from '@/lib/marketing/copy'

interface SampleReportSectionProps {
  audit?: LiveSampleAudit
}

export function SampleReportSection({ audit }: SampleReportSectionProps) {
  const { label, headline, body } = LANDING_PAGE.sampleReport

  return (
    <Section spacing="marketing" id="sample-review" className="scroll-mt-[var(--header-offset)]">
      <Container className="space-y-8 sm:space-y-11">
        <RevealOnView>
          <LandingSectionHeader label={label} headline={headline} showLabel />
          <p className="mx-auto mt-3 max-w-2xl text-balance text-center text-base leading-relaxed text-muted-foreground">
            {body}
          </p>
        </RevealOnView>

        <div className="relative motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:forwards]">
          <HeroProductPreview audit={audit} />
        </div>
      </Container>
    </Section>
  )
}
