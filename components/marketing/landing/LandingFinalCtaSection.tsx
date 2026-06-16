import { AuditInput } from '@/components/audit/AuditInput'
import { LandingTrustBadges } from '@/components/marketing/landing/LandingTrustBadges'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Muted } from '@/components/ui/typography'
import { FINAL_CTA } from '@/lib/marketing/copy'

export function LandingFinalCtaSection() {
  return (
    <Section spacing="loose" className="bg-brand/[0.06]">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr_1fr] lg:gap-12">
          <Heading as="h2" className="text-balance lg:max-w-xs">
            {FINAL_CTA.headline}{' '}
            <span className="text-brand">{FINAL_CTA.headlineAccent}</span>
            {FINAL_CTA.headlineSuffix}
          </Heading>

          <div className="space-y-5">
            <Muted className="max-w-md text-base leading-relaxed">{FINAL_CTA.body}</Muted>
            <AuditInput variant="landing-final" />
          </div>

          <LandingTrustBadges className="lg:justify-start" />
        </div>
      </Container>
    </Section>
  )
}
