import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { SampleFindingsCard } from '@/components/marketing/SampleFindingsCard'
import { MarketingBackdrop } from '@/components/marketing/MarketingBackdrop'
import { TrustStrip } from '@/components/marketing/TrustStrip'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading, Muted } from '@/components/ui/typography'
import { BRAND, HERO, HERO_MECHANISM_LINE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const STAGGER = [
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:80ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:160ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:240ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:320ms]',
  'animate-scale-in opacity-0 [animation-fill-mode:forwards] [animation-delay:380ms]',
]

export function HeroSection() {
  return (
    <Section spacing="loose" className="relative overflow-hidden">
      <MarketingBackdrop />
      <Container>
        <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <p className={cn('font-mono text-[11px] uppercase tracking-label text-muted-foreground/80', STAGGER[0])}>
              {BRAND.tribeBadge}
            </p>

            <div className={cn('mt-8 max-w-xl space-y-5', STAGGER[1])}>
              <Heading as="h1" className="space-y-1">
                <span className="block">{HERO.headlineLine1}</span>
                <span className={cn('block', HERO.headlineAccent && 'italic text-foreground/88')}>
                  {HERO.headlineLine2}
                </span>
              </Heading>
              <Body className="max-w-md text-muted-foreground lg:mx-0">{HERO.subhead}</Body>
            </div>

            <p className={cn('mt-6 font-mono text-xs text-muted-foreground/90', STAGGER[2])}>
              {HERO_MECHANISM_LINE}
            </p>

            <div className={cn('mt-8 w-full max-w-xl', STAGGER[3])}>
              <AuditInput />
            </div>

            <div className={cn('mt-3 space-y-4', STAGGER[4])}>
              <Muted>{HERO.trustLine}</Muted>
              <TrustStrip />
            </div>

            <div className={cn('mt-5', STAGGER[5])}>
              <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                <Link href="/samples">
                  {HERO.secondaryCta}
                  <ArrowRight className="ml-2 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none lg:mx-0">
            <SampleFindingsCard className="shadow-raised" />
          </div>
        </div>
      </Container>
    </Section>
  )
}
