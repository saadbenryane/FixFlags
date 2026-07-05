import { CheckCircle2 } from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { AuditInput } from '@/components/audit/AuditInput'
import { BrandIllustration } from '@/components/marketing/landing/BrandIllustration'
import { FINAL_CTA, HERO } from '@/lib/marketing/copy'

const TRUST_BADGES = HERO.trustBadges

export function LandingFinalCtaSection() {
  return (
    <Section spacing="marketing" className="pb-11 sm:pb-14">
      <Container>
        <div className="relative overflow-hidden rounded-card p-8 glass-surface-strong shadow-card sm:p-12 lg:p-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-28 h-72 bg-[radial-gradient(ellipse_60%_55%_at_72%_35%,hsl(var(--brand)/0.18),transparent_68%)] blur-[80px]"
          />
          <BrandIllustration
            sizes="(min-width: 1024px) 260px, 0px"
            className="absolute -bottom-24 -right-6 hidden h-80 w-60 rotate-3 rounded-[2rem] opacity-65 lg:block xl:right-6"
            imageClassName="scale-110"
          />
          <div className="relative z-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-6">
              <h2 className="font-serif text-4xl font-medium leading-display tracking-display text-balance text-foreground sm:text-5xl">
                {FINAL_CTA.headline}{' '}
                <span className="text-brand">
                  {FINAL_CTA.headlineAccent}
                </span>
              </h2>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                {FINAL_CTA.body}
              </p>
            </div>

            <div className="space-y-5">
              <AuditInput variant="landing" idSuffix="-final-cta" />
              <ul className="flex flex-col gap-3">
                {TRUST_BADGES.map((badge) => (
                  <li
                    key={badge}
                    className="flex items-center gap-2.5 text-sm font-medium text-muted-foreground"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" aria-hidden />
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
