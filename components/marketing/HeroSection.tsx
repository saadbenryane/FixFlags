import Link from 'next/link'
import { AuditInput } from '@/components/audit/AuditInput'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { SampleFindingsCard } from '@/components/marketing/SampleFindingsCard'
import { MarketingBackdrop } from '@/components/marketing/MarketingBackdrop'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { Body, Heading, Muted } from '@/components/ui/typography'
import { HERO, HERO_FIX_PROMPT, WORKFLOW_STEPS } from '@/lib/marketing/copy'
import type { SampleResult } from '@/lib/marketing/live-sample'
import { cn } from '@/lib/utils'

const STAGGER = [
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:120ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:220ms]',
  'animate-fade-in-up opacity-0 [animation-fill-mode:forwards] [animation-delay:280ms]',
  'animate-scale-in opacity-0 [animation-fill-mode:forwards] [animation-delay:320ms]',
]

export function HeroSection({ sample }: { sample: SampleResult }) {
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

            <div className={cn('mt-8 space-y-4', STAGGER[3])}>
              <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                Agent workflow
              </p>
              <ol className="grid gap-2 sm:grid-cols-2">
                {WORKFLOW_STEPS.map((step) => (
                  <li
                    key={step.step}
                    className="rounded-md border border-border/20 bg-card/50 px-3 py-2.5"
                  >
                    <p className="text-xs font-semibold">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.body}</p>
                  </li>
                ))}
              </ol>
              <div className="rounded-md border border-border/20 bg-muted/20 p-3 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                  {HERO_FIX_PROMPT.label}
                </p>
                <p className="text-xs font-medium">{HERO_FIX_PROMPT.finding}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{HERO_FIX_PROMPT.prompt}</p>
                <PromptCopyButton prompt={HERO_FIX_PROMPT.prompt} compact />
              </div>
              <Link
                href="/#agent-workflow"
                className="text-sm text-brand link-underline-grow"
              >
                See full agent workflow
              </Link>
            </div>
          </div>

          <div className={cn('lg:sticky lg:top-24', STAGGER[4])}>
            <SampleFindingsCard sample={sample} />
          </div>
        </div>
      </Container>
    </Section>
  )
}
