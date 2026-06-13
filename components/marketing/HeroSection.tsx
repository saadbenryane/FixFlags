import Link from 'next/link'
import { ArrowRight, CheckCircle2, Zap } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { SampleFindingsCard } from '@/components/marketing/SampleFindingsCard'
import { MarketingBackdrop } from '@/components/marketing/MarketingBackdrop'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading, Muted } from '@/components/ui/typography'
import { BRAND, HERO, HERO_PILLS } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const STAGGER = [
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:80ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:160ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:240ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:320ms]',
  'animate-scale-in opacity-0 [animation-fill-mode:forwards] [animation-delay:420ms]',
]

export function HeroSection() {
  return (
    <Section spacing="loose" className="relative overflow-hidden">
      <MarketingBackdrop />
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 xl:gap-20">
          <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
            <div
              className={cn(
                'inline-flex items-center gap-2 rounded-full border overlay-pill-glass px-3 py-1.5 text-xs text-muted-foreground',
                STAGGER[0]
              )}
            >
              <Zap className="h-3.5 w-3.5 text-brand" />
              {BRAND.tribeBadge}
            </div>

            <div className={cn('mt-8 max-w-xl space-y-7', STAGGER[1])}>
              <Heading as="h1" className="space-y-3">
                <span className="block">{HERO.headlineLine1}</span>
                <span className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1 lg:justify-start">
                  <span>{HERO.headlineLine2}</span>
                  <span
                    className="inline-block text-[0.92em] leading-none translate-y-[0.06em]"
                    role="img"
                    aria-label="rocket"
                  >
                    {HERO.headlineEmoji}
                  </span>
                </span>
              </Heading>
              <Body className="max-w-lg text-muted-foreground lg:mx-0">{HERO.subhead}</Body>
            </div>

            <div
              className={cn(
                'mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 lg:justify-start',
                STAGGER[2]
              )}
            >
              {HERO_PILLS.map((item, i) => (
                <span key={item} className="inline-flex items-center gap-4">
                  {i > 0 && <span className="hidden sm:inline text-border">·</span>}
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 shrink-0 text-brand" />
                    {item}
                  </span>
                </span>
              ))}
            </div>

            <div className={cn('mt-8 w-full max-w-xl', STAGGER[3])}>
              <AuditInput />
            </div>

            <Muted className={cn('mt-3', STAGGER[4])}>{HERO.trustLine}</Muted>

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
            <div className="absolute -inset-4 rounded-card bg-gradient-to-br from-brand/10 via-transparent to-stone-500/10 blur-2xl" />
            <SampleFindingsCard className="relative lg:rotate-[1.5deg] lg:translate-y-2 transition-transform duration-500 hover:rotate-0 hover:translate-y-0" />
          </div>
        </div>
      </Container>
    </Section>
  )
}
