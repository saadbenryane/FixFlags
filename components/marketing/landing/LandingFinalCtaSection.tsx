import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { AuditInput } from '@/components/audit/AuditInput'
import { FINAL_CTA, HERO } from '@/lib/marketing/copy'

const TRUST_BADGES = HERO.trustBadges

export function LandingFinalCtaSection() {
  return (
    <Section spacing="marketing" className="pb-11 sm:pb-14">
      <Container>
        <div className="relative overflow-hidden rounded-card p-8 glass-surface-strong shadow-card sm:p-12 lg:p-16">
          <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-6">
              <h2 className="text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
                {FINAL_CTA.headline}{' '}
                <span className="bg-gradient-peach-accent bg-clip-text text-transparent">
                  {FINAL_CTA.headlineAccent}
                </span>
              </h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                {FINAL_CTA.body}
              </p>
            </div>

            <div className="space-y-5">
              <AuditInput variant="landing" />
              <ul className="flex flex-col gap-3">
                {TRUST_BADGES.map((badge) => (
                  <li key={badge} className="text-sm font-medium text-muted-foreground">
                    {badge}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
