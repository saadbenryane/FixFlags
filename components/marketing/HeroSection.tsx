'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { MechanismChips } from '@/components/marketing/MechanismChips'
import { SampleFindingsCard } from '@/components/marketing/SampleFindingsCard'
import { MarketingBackdrop } from '@/components/marketing/MarketingBackdrop'
import { Container } from '@/components/ui/container'
import { PageGrid, PageGridCol } from '@/components/ui/page-grid'
import { Section } from '@/components/ui/section'
import { TextLink } from '@/components/ui/text-link'
import { Body, Heading, Lead, Muted } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'
import { TRUST_LINE } from '@/lib/marketing/display-meta'
import type { SampleResult } from '@/lib/marketing/live-sample'
import { cn } from '@/lib/utils'

const STAGGER = [
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:120ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:220ms]',
  'animate-scale-in opacity-0 [animation-fill-mode:forwards] [animation-delay:280ms]',
]

export function HeroSection({ sample }: { sample: SampleResult }) {
  return (
    <Section spacing="default" className="relative overflow-hidden bg-muted/25">
      <MarketingBackdrop />
      <Container>
        <PageGrid align="center">
          <PageGridCol span="text" className="flex flex-col">
            <div className={cn('space-y-5', STAGGER[0])}>
              <Heading as="h1" className="space-y-2">
                <span className="block">{HERO.headlineLine1}</span>
                <span className="relative inline-block italic text-foreground/90">
                  {HERO.headlineLine2}
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-brand/35"
                  />
                </span>
              </Heading>
              <Lead>{HERO.subhead}</Lead>
            </div>

            <div className={cn('mt-8 w-full max-w-prose', STAGGER[1])}>
              <AuditInput />
            </div>

            <Muted className={cn('mt-4', STAGGER[2])}>{TRUST_LINE}</Muted>

            <MechanismChips className={cn('mt-6', STAGGER[2])} />

            <TextLink href="/#agent-workflow" className={cn('mt-6 text-sm', STAGGER[3])}>
              See full agent workflow
              <ArrowRight className="h-3.5 w-3.5" />
            </TextLink>
          </PageGridCol>

          <PageGridCol
            span="card"
            className={cn('mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none lg:sticky lg:top-[var(--header-offset)]', STAGGER[3])}
          >
            <SampleFindingsCard sample={sample} variant="teaser" />
          </PageGridCol>
        </PageGrid>
      </Container>
    </Section>
  )
}
