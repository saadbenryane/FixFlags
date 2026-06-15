'use client'

import { ArrowRight } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { MarketingBackdrop } from '@/components/marketing/MarketingBackdrop'
import { MarketingIllustration } from '@/components/marketing/MarketingIllustration'
import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import { Heading, Lead, Muted } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'
import { TRUST_LINE } from '@/lib/marketing/display-meta'
import { cn } from '@/lib/utils'

const STAGGER = [
  'motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards]',
  'motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards] motion-safe:[animation-delay:120ms]',
  'motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards] motion-safe:[animation-delay:220ms]',
  'motion-safe:animate-scale-in motion-safe:opacity-0 motion-safe:[animation-fill-mode:forwards] motion-safe:[animation-delay:320ms]',
]

export function HeroSection() {
  return (
    <Section spacing="loose" className="relative overflow-hidden bg-muted/25 pb-12 sm:pb-16 lg:pb-20">
      <MarketingBackdrop />
      <Container>
        <PageGrid align="center" className="gap-8 lg:gap-10">
          <PageGridCol span="text" className={cn('space-y-8', STAGGER[0])}>
            <div className="space-y-4">
              <p className="section-label">{HERO.audienceLine}</p>
              <Heading as="h1" className="space-y-1 text-balance">
                <span className="block">{HERO.headlineLine1}</span>
                <span className="block text-foreground">{HERO.headlineLine2}</span>
              </Heading>
              <Lead>{HERO.subhead}</Lead>
            </div>

            <div
              id="audit"
              className={cn('scroll-mt-[calc(var(--header-offset)+1rem)]', STAGGER[1])}
            >
              <AuditInput />
            </div>

            <div className={cn('space-y-6', STAGGER[2])}>
              <Muted>{TRUST_LINE}</Muted>
              <TextLink href="/samples" className="text-sm">
                {HERO.secondaryCta}
                <ArrowRight className="h-3.5 w-3.5" />
              </TextLink>
            </div>
          </PageGridCol>

          <PageGridCol span="card" className={STAGGER[3]}>
            <MarketingIllustration
              variant="hero"
              alt=""
              priority
              className="max-w-md lg:ml-auto"
            />
          </PageGridCol>
        </PageGrid>
      </Container>
    </Section>
  )
}
