import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { LandingTrustBadges } from '@/components/marketing/landing/LandingTrustBadges'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Button } from '@/components/ui/button'
import { Heading, Muted } from '@/components/ui/typography'
import { FINAL_CTA, HERO } from '@/lib/marketing/copy'

export function LandingFinalCtaSection() {
  return (
    <Section spacing="marketing" className="pb-16 sm:pb-20">
      <Container>
        <div className="rounded-card bg-brand/[0.08] p-8 sm:p-10 lg:p-12">
          <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_auto] lg:gap-10">
            <Heading as="h2" className="text-balance lg:max-w-xs">
              {FINAL_CTA.headline}{' '}
              <span className="text-brand">{FINAL_CTA.headlineAccent}</span>
              {FINAL_CTA.headlineSuffix}
            </Heading>

            <Muted className="max-w-md text-base leading-relaxed text-pretty">
              {FINAL_CTA.body}
            </Muted>

            <div className="flex flex-col items-start gap-5 lg:items-end">
              <Button size="lg" className="h-12 gap-2 px-6" asChild>
                <Link href="/#audit">
                  {HERO.primaryCta}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <LandingTrustBadges className="justify-start lg:justify-end" />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  )
}
