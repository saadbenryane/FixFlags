import { AuditInput } from '@/components/audit/AuditInput'
import { HeroProductPreview } from '@/components/marketing/landing/HeroProductPreview'
import { LandingTrustBadges } from '@/components/marketing/landing/LandingTrustBadges'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { HERO } from '@/lib/marketing/copy'

export function LandingHeroSection() {
  return (
    <Section spacing="loose" className="relative pb-8 sm:pb-12 lg:pb-16">
      <Container className="relative space-y-12 lg:space-y-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <h1 className="max-w-[20ch] text-balance text-4xl font-bold leading-[1.1] tracking-tight motion-safe:animate-fade-in-up sm:text-5xl lg:text-6xl">
            {HERO.headlineLine1}{' '}
            <br className="hidden sm:block" />
            <span className="bg-gradient-peach-accent bg-clip-text text-transparent">{HERO.headlineAccent}</span>.
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground motion-safe:animate-fade-in-up motion-safe:[animation-delay:80ms] motion-safe:[animation-fill-mode:both] sm:text-lg">
            {HERO.subhead}
          </p>

          <div
            id="audit"
            className="mt-8 w-full max-w-2xl scroll-mt-[calc(var(--header-offset)+1rem)] motion-safe:animate-fade-in-up motion-safe:[animation-delay:160ms] motion-safe:[animation-fill-mode:both]"
          >
            <AuditInput variant="landing" />
          </div>

          <LandingTrustBadges className="mt-5" />
        </div>

        <div className="motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:forwards]">
          <HeroProductPreview />
        </div>
      </Container>
    </Section>
  )
}
