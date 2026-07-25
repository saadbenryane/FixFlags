'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Crosshair,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

type DimensionId = (typeof LANDING_PAGE.checkDimensions.cards)[number]['id']
type TabId = DimensionId | 'all'

const RUBRIC_ICONS = {
  message: MessageSquare,
  experience: Sparkles,
  reach: Crosshair,
} as const

const VALUE_ICONS = {
  shield: ShieldCheck,
  target: Crosshair,
  zap: Zap,
  refresh: RefreshCw,
} as const

const RUBRICS_TILES: Record<DimensionId, { light: string; dark: string }> = {
  message: {
    light: '/marketing/visuals/rubrics-01-light.webp',
    dark: '/marketing/visuals/rubrics-01-dark.webp',
  },
  experience: {
    light: '/marketing/visuals/rubrics-02-light.webp',
    dark: '/marketing/visuals/rubrics-02-dark.webp',
  },
  reach: {
    light: '/marketing/visuals/rubrics-03-light.webp',
    dark: '/marketing/visuals/rubrics-03-dark.webp',
  },
}

const SEVERITY_TONE: Record<string, string> = {
  High: 'bg-destructive/10 text-destructive',
  Medium: 'bg-brand/10 text-brand',
  Good: 'bg-success/10 text-success',
}

export function CheckDimensionsSection() {
  const copy = LANDING_PAGE.checkDimensions
  const [tab, setTab] = useState<TabId>('message')
  const activeCard =
    tab === 'all'
      ? null
      : copy.cards.find((card) => card.id === tab) ?? copy.cards[0]!

  return (
    <Section
      spacing="marketing"
      id="what-it-checks"
      className="scroll-mt-[var(--header-offset)] bg-muted/20"
    >
      <Container className="space-y-8 sm:space-y-10">
        <div className="mx-auto max-w-3xl space-y-3 text-center">
          <p className="inline-flex items-center justify-center gap-2 font-mono text-[0.6875rem] font-medium uppercase tracking-label text-brand sm:text-xs">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
            {copy.label}
          </p>
          <h2 className="font-display text-2xl font-semibold leading-display tracking-display text-balance sm:text-[1.75rem] md:text-[2rem]">
            {copy.headlineDisplay}
            {copy.headlineAccentPeriod ? (
              <span className="text-brand" aria-hidden>
                .
              </span>
            ) : null}
          </h2>
          <p className="mx-auto max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty">
            {copy.subhead}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Release readiness dimensions"
          className="flex gap-1 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:justify-center [&::-webkit-scrollbar]:hidden"
        >
          {copy.cards.map((card) => {
            const Icon = RUBRIC_ICONS[card.icon as keyof typeof RUBRIC_ICONS]
            const selected = tab === card.id
            return (
              <button
                key={card.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setTab(card.id)}
                className={cn(
                  'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4',
                  selected
                    ? 'border-brand text-brand'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                {card.title}
              </button>
            )
          })}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'all'}
            onClick={() => setTab('all')}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4',
              tab === 'all'
                ? 'border-brand text-brand'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {copy.allChecksTab}
          </button>
        </div>

        <RevealOnView>
          {tab === 'all' ? (
            <div className="grid gap-4 md:grid-cols-3">
              {copy.cards.map((card) => {
                const Icon = RUBRIC_ICONS[card.icon as keyof typeof RUBRIC_ICONS]
                return (
                  <article
                    key={card.id}
                    className="rounded-card bg-background/80 p-5 shadow-card sm:p-6"
                  >
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-brand/10 text-brand">
                      <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                    </div>
                    <h3 className="mt-4 text-base font-semibold">{card.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                      {card.question}
                    </p>
                    <ul className="mt-4 space-y-2">
                      {card.checks.map((check) => (
                        <li
                          key={check}
                          className="flex items-start gap-2 text-sm text-foreground/85"
                        >
                          <CheckCircle2
                            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand"
                            aria-hidden
                          />
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              })}
            </div>
          ) : activeCard ? (
            <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,0.85fr)] lg:gap-6 xl:gap-10">
              <div className="space-y-4">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-brand/10 text-brand">
                  {(() => {
                    const Icon = RUBRIC_ICONS[activeCard.icon as keyof typeof RUBRIC_ICONS]
                    return <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  })()}
                </div>
                <h3 className="text-xl font-semibold tracking-heading">{activeCard.panelTitle}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty sm:text-base">
                  {activeCard.panelBody}
                </p>
                <ul className="space-y-2.5 pt-1">
                  {activeCard.checks.map((check) => (
                    <li key={check} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckCircle2
                        className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                        aria-hidden
                      />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-card bg-muted/35 shadow-glass lg:max-w-none">
                <Image
                  src={RUBRICS_TILES[activeCard.id].light}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 360px, 90vw"
                  loading="lazy"
                  unoptimized
                  className="object-cover object-center dark:hidden"
                />
                <Image
                  src={RUBRICS_TILES[activeCard.id].dark}
                  alt=""
                  fill
                  sizes="(min-width: 1024px) 360px, 90vw"
                  loading="lazy"
                  unoptimized
                  className="hidden object-cover object-center dark:block"
                />
              </div>

              <div className="rounded-card bg-background p-5 shadow-card sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold">{copy.topIssuesTitle}</h4>
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand/10 px-2 text-xs font-semibold tabular-nums text-brand">
                    {activeCard.topIssues.length}
                  </span>
                </div>
                <ul className="mt-4 space-y-3">
                  {activeCard.topIssues.map((issue) => (
                    <li
                      key={issue.title}
                      className="flex items-center justify-between gap-3 border-b border-border/50 pb-3 last:border-0 last:pb-0"
                    >
                      <span className="text-sm font-medium text-foreground text-pretty">
                        {issue.title}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold',
                          SEVERITY_TONE[issue.severity] ?? 'bg-muted text-muted-foreground'
                        )}
                      >
                        {issue.severity}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/samples"
                  className="mt-5 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover"
                >
                  {copy.viewAllIssues}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </div>
          ) : null}
        </RevealOnView>

        <ul className="grid gap-6 border-t border-border/50 pt-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {copy.values.map((item) => {
            const Icon = VALUE_ICONS[item.icon]
            return (
              <li key={item.id} className="space-y-2.5 text-center sm:text-left lg:text-center">
                <span className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] bg-background shadow-card text-brand sm:mx-0 lg:mx-auto">
                  <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                </span>
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                  {item.body}
                </p>
              </li>
            )
          })}
        </ul>
      </Container>
    </Section>
  )
}
