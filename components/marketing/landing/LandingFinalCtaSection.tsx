import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LandingTrustBadges } from '@/components/marketing/landing/LandingTrustBadges'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Heading, Muted } from '@/components/ui/typography'
import { FINAL_CTA, HERO } from '@/lib/marketing/copy'

export function LandingFinalCtaSection() {
  return (
    <Section spacing="marketing" className="bg-brand/[0.08]">
      <Container>
        <div className="grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-12">
          <Heading as="h2" className="text-balance lg:max-w-sm">
            {FINAL_CTA.headline}{' '}
            <span className="text-brand">{FINAL_CTA.headlineAccent}</span>
            {FINAL_CTA.headlineSuffix}
          </Heading>

          <div className="space-y-5 text-center lg:text-left">
            <Muted className="mx-auto max-w-md text-base leading-relaxed lg:mx-0">
              {FINAL_CTA.body}
            </Muted>
            <Button size="lg" asChild className="h-12 px-8">
              <Link href="/#audit">
                {HERO.primaryCta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <LandingTrustBadges className="lg:justify-start" />
        </div>
      </Container>
    </Section>
  )
}
