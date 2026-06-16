import { AuditInput } from '@/components/audit/AuditInput'
import { LandingTrustBadges } from '@/components/marketing/landing/LandingTrustBadges'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Muted } from '@/components/ui/typography'
import { FINAL_CTA } from '@/lib/marketing/copy'

export function LandingFinalCtaSection() {
  return (
    <Section spacing="marketing" className="bg-brand/[0.08]">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-12">
          <Heading as="h2" className="text-balance lg:max-w-sm">
            {FINAL_CTA.headline}{' '}
            <span className="text-brand">{FINAL_CTA.headlineAccent}</span>
            {FINAL_CTA.headlineSuffix}
          </Heading>

          <div className="space-y-5">
            <Muted className="max-w-md text-base leading-relaxed text-pretty">
              {FINAL_CTA.body}
            </Muted>
            <AuditInput variant="landing-final" idSuffix="-final" />
            <LandingTrustBadges />
          </div>
        </div>
      </Container>
    </Section>
  )
}
