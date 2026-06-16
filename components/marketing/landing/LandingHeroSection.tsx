'use client'

import { AuditInput } from '@/components/audit/AuditInput'
import { HeroProductPreview } from '@/components/marketing/landing/HeroProductPreview'
import { LandingTrustBadges } from '@/components/marketing/landing/LandingTrustBadges'
import { MarketingBackdrop } from '@/components/marketing/MarketingBackdrop'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Lead } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export function LandingHeroSection() {
  return (
    <Section spacing="loose" className="relative overflow-hidden pb-8 sm:pb-12 lg:pb-16">
      <MarketingBackdrop />
      <Container className="relative space-y-12 lg:space-y-16">
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          <p className="font-mono text-[11px] uppercase tracking-label text-brand">
            {HERO.badge}
          </p>

          <Heading as="h1" className="mt-5 max-w-[20ch] text-balance sm:max-w-none">
            {HERO.headlineLine1}{' '}
            <span className="text-brand">{HERO.headlineAccent}</span>.
          </Heading>

          <Lead className="mx-auto mt-5 max-w-2xl text-pretty">{HERO.subhead}</Lead>

          <div
            id="audit"
            className="mt-8 w-full max-w-2xl scroll-mt-[calc(var(--header-offset)+1rem)]"
          >
            <AuditInput variant="landing" />
          </div>

          <LandingTrustBadges className="mt-6" />
        </div>

        <div
          className={cn(
            'motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards] motion-safe:[animation-delay:200ms]'
          )}
        >
          <HeroProductPreview />
        </div>
      </Container>
    </Section>
  )
}
