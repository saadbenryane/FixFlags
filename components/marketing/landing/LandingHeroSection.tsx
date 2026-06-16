'use client'

import { AuditInput } from '@/components/audit/AuditInput'
import { HeroProductPreview } from '@/components/marketing/landing/HeroProductPreview'
import { LandingTrustBadges } from '@/components/marketing/landing/LandingTrustBadges'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { HERO } from '@/lib/marketing/copy'

export function LandingHeroSection() {
  return (
    <Section spacing="loose" className="relative overflow-hidden pb-8 sm:pb-12 lg:pb-16">
      {/* Soft gradient background blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Top-center warm glow */}
        <div className="absolute -top-40 left-1/2 h-[600px] w-[800px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse,hsl(24_100%_60%/0.12),transparent_65%)]" />
        {/* Top-right peachy blob */}
        <div className="absolute -right-40 -top-20 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,hsl(340_80%_75%/0.07),transparent_65%)]" />
        {/* Bottom-left cool tint */}
        <div className="absolute -bottom-20 -left-20 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,hsl(200_80%_70%/0.06),transparent_65%)]" />
      </div>

      <Container className="relative space-y-12 lg:space-y-16">
        {/* Text block */}
        <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
          {/* Eyebrow */}
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-orange-500">
            {HERO.audienceLine}
          </p>

          {/* Headline */}
          <h1 className="mt-5 max-w-[20ch] text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
            Ship AI-built products{' '}
            <br className="hidden sm:block" />
            people can{' '}
            <span className="text-orange-500">{HERO.headlineAccent}</span>.
          </h1>

          {/* Subhead */}
          <p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            {HERO.subhead}
          </p>

          {/* Input */}
          <div
            id="audit"
            className="mt-8 w-full max-w-2xl scroll-mt-[calc(var(--header-offset)+1rem)]"
          >
            <AuditInput variant="landing" />
          </div>

          {/* Trust badges */}
          <LandingTrustBadges className="mt-5" />
        </div>

        {/* Product preview card */}
        <div className="motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:forwards]">
          <HeroProductPreview />
        </div>
      </Container>
    </Section>
  )
}
