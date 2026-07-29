'use client'

import { useId, useState } from 'react'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  RefreshCw,
  Search,
  Wrench,
} from 'lucide-react'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { HowItWorksSampleLink } from '@/components/marketing/landing/SampleFunnelEvents'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { rubricIcon } from '@/lib/rubric-icons'
import { cn } from '@/lib/utils'

type RubricId = (typeof LANDING_PAGE.checkDimensions.cards)[number]['id']

const LOOP_ICONS = [Search, Wrench, RefreshCw] as const

function ReportDemo() {
  const copy = LANDING_PAGE.checkDimensions
  const demo = LANDING_PAGE.howItWorks.demo
  const [activeRubric, setActiveRubric] = useState<RubricId>('experience')
  const tabsId = useId()
  const active =
    copy.cards.find((card) => card.id === activeRubric) ?? copy.cards[0]!
  const ActiveIcon = rubricIcon(active.icon)
  const issue = active.topIssues[0]

  return (
    <div className="overflow-hidden rounded-[1.25rem] border border-border/50 bg-background shadow-[0_24px_70px_-34px_hsl(240_8%_5%/0.32),0_2px_10px_hsl(240_8%_5%/0.06)]">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-border/45 px-4 sm:px-5">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">
            {demo.reportTitle}
          </p>
          <p className="truncate font-mono text-[0.625rem] text-muted-foreground">
            {demo.hostname}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[0.6875rem] font-medium text-success">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {demo.status}
        </span>
      </div>

      <div
        role="tablist"
        aria-label="FixFlags report rubrics"
        className="grid grid-cols-3 border-b border-border/45 bg-muted/15 px-2 sm:px-4"
      >
        {copy.cards.map((card) => {
          const Icon = rubricIcon(card.icon)
          const selected = card.id === activeRubric
          return (
            <button
              key={card.id}
              id={`${tabsId}-${card.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${tabsId}-panel`}
              onClick={() => setActiveRubric(card.id)}
              className={cn(
                'relative inline-flex min-h-12 items-center justify-center gap-2 px-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:text-sm',
                selected
                  ? 'text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brand'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                className={cn('h-3.5 w-3.5', selected && 'text-brand')}
                strokeWidth={1.8}
                aria-hidden
              />
              {card.title}
            </button>
          )
        })}
      </div>

      <div
        id={`${tabsId}-panel`}
        role="tabpanel"
        aria-labelledby={`${tabsId}-${activeRubric}`}
        className="grid min-h-[25rem] lg:grid-cols-[0.78fr_1.22fr]"
      >
        <div className="border-b border-border/45 p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[0.55rem] bg-brand/10 text-brand">
              <ActiveIcon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {active.panelTitle}
              </p>
              <p className="text-[0.6875rem] text-muted-foreground">
                {active.question}
              </p>
            </div>
          </div>

          <p className="mt-5 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {demo.priorityLabel}
          </p>
          <div className="mt-2 rounded-[0.75rem] bg-muted/25 p-3 ring-1 ring-border/45">
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-foreground">
                  {issue.title}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {issue.body}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-success" aria-hidden />
            {demo.evidenceLabel}
          </div>
        </div>

        <div className="flex flex-col p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">
                {demo.promptTitle}
              </p>
              <p className="text-[0.6875rem] text-muted-foreground">
                {demo.promptStatus}
              </p>
            </div>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] px-3 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-label={demo.copyAriaLabel}
            >
              <Copy className="h-3.5 w-3.5" aria-hidden />
              {demo.copyAction}
            </button>
          </div>

          <div className="mt-3 flex-1 rounded-[0.8rem] bg-foreground p-4 text-background shadow-inner">
            <p className="font-mono text-[0.6875rem] leading-[1.75] text-background/75">
              {demo.prompt}
            </p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-[0.7rem] bg-success/8 px-3 py-2.5 text-xs">
            <span className="inline-flex items-center gap-2 font-medium text-foreground">
              <RefreshCw className="h-3.5 w-3.5 text-success" aria-hidden />
              {demo.recheckLabel}
            </span>
            <ChevronRight
              className="h-3.5 w-3.5 text-muted-foreground"
              aria-hidden
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface HowItWorksLoopSectionProps {
  sampleHref?: string
}

export function HowItWorksLoopSection({
  sampleHref = '/samples',
}: HowItWorksLoopSectionProps) {
  const copy = LANDING_PAGE.howItWorks

  return (
    <Section
      spacing="marketing"
      id="how-it-works"
      tint="subtle"
      className="relative scroll-mt-[var(--header-offset)] overflow-hidden"
    >
      <Container variant="marketing" className="px-4 sm:px-6 lg:px-12">
        <LandingSectionHeader
          label={copy.label}
          brandEyebrow
          headline={copy.headlineDisplay}
          accentPeriod={copy.headlineAccentPeriod}
          subhead={copy.subhead}
        />

        <RevealOnView>
          <div className="mx-auto mt-10 grid max-w-[72rem] items-start gap-8 lg:grid-cols-[minmax(13rem,0.52fr)_minmax(0,1.48fr)] lg:gap-10">
            <div className="lg:sticky lg:top-[calc(var(--header-offset)+2rem)]">
              <p className="font-display text-xl font-semibold tracking-heading text-foreground">
                {copy.demo.heading}
              </p>
              <p className="mt-2 max-w-[30rem] text-sm leading-relaxed text-muted-foreground">
                {copy.demo.body}
              </p>

              <ol className="mt-6 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {copy.steps.map((step, index) => {
                  const Icon = LOOP_ICONS[index] ?? Search
                  return (
                    <li
                      key={step.title}
                      className="group flex min-w-0 items-start gap-3 rounded-[0.75rem] px-3 py-3 lg:-ml-3"
                    >
                      <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.6rem] bg-background text-brand shadow-sm ring-1 ring-border/45">
                        <Icon className="h-4 w-4" strokeWidth={1.8} aria-hidden />
                        {index < copy.steps.length - 1 ? (
                          <span
                            className="absolute left-1/2 top-full hidden h-5 w-px bg-border lg:block"
                            aria-hidden
                          />
                        ) : null}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          {step.title}
                        </p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ol>

              <div className="mt-5">
                <HowItWorksSampleLink
                  href={sampleHref}
                  label={copy.sampleLink}
                />
              </div>
            </div>

            <ReportDemo />
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}
