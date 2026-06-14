import { AuditInput } from '@/components/audit/AuditInput'
import { SampleFindingsCard } from '@/components/marketing/SampleFindingsCard'
import { MarketingBackdrop } from '@/components/marketing/MarketingBackdrop'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading, Muted } from '@/components/ui/typography'
import { HERO } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const STAGGER = [
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:120ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:220ms]',
  'animate-scale-in opacity-0 [animation-fill-mode:forwards] [animation-delay:320ms]',
]

export function HeroSection() {
  return (
    <Section spacing="loose" className="relative overflow-hidden">
      <MarketingBackdrop />
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-14 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:gap-16">
          <div className="flex flex-col lg:max-w-xl lg:pt-2">
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
              <Body className="max-w-md text-muted-foreground">{HERO.subhead}</Body>
            </div>

            <div className={cn('mt-8 w-full', STAGGER[1])}>
              <AuditInput />
            </div>

            <Muted className={cn('mt-4', STAGGER[2])}>{HERO.trustLine}</Muted>
          </div>

          <div className={cn('lg:sticky lg:top-24', STAGGER[3])}>
            <SampleFindingsCard />
          </div>
        </div>
      </Container>
    </Section>
  )
}
