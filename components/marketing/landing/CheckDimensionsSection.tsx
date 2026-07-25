'use client'

import Link from 'next/link'
import { useCallback, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Crosshair,
  Info,
  LayoutGrid,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { CheckDimensionsScene } from '@/components/marketing/landing/CheckDimensionsScene'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { RUBRIC_ICONS } from '@/components/marketing/landing/rubric-icons'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

type DimensionId = (typeof LANDING_PAGE.checkDimensions.cards)[number]['id']
type TabId = DimensionId | 'all'

const VALUE_ICONS = {
  shield: ShieldCheck,
  target: Crosshair,
  zap: Zap,
  refresh: RefreshCw,
} as const

const SEVERITY_TONE: Record<string, string> = {
  High: 'bg-destructive/10 text-destructive',
  Medium: 'bg-brand/10 text-brand',
  Good: 'bg-success/10 text-success',
}

function SeverityIcon({ severity }: { severity: string }) {
  if (severity === 'High') {
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" strokeWidth={2} aria-hidden />
  }
  if (severity === 'Good') {
    return <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={2} aria-hidden />
  }
  return <Info className="h-3.5 w-3.5 text-brand" strokeWidth={2} aria-hidden />
}

function ValuePedestal({
  icon: Icon,
}: {
  icon: (typeof VALUE_ICONS)[keyof typeof VALUE_ICONS]
}) {
  return (
    <span className="relative inline-flex h-14 w-14 shrink-0 items-center justify-center">
      {/* Soft pedestal shadow — CSS only, no white-fringe raster */}
      <span
        aria-hidden
        className="absolute bottom-0.5 h-3 w-10 rounded-full bg-foreground/10 blur-[6px]"
      />
      <span
        aria-hidden
        className="absolute bottom-1 h-2.5 w-9 rounded-full bg-background shadow-[0_1px_2px_hsl(240_8%_5%/0.08),inset_0_1px_0_hsl(0_0%_100%/0.9)]"
      />
      <span className="relative flex h-11 w-11 items-center justify-center rounded-full bg-background text-brand shadow-[0_6px_16px_-8px_hsl(240_8%_5%/0.28),inset_0_1px_0_hsl(0_0%_100%/0.95)]">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </span>
    </span>
  )
}

export function CheckDimensionsSection() {
  const copy = LANDING_PAGE.checkDimensions
  const baseId = useId()
  const tabIds: TabId[] = [...copy.cards.map((c) => c.id), 'all']
  const [tab, setTab] = useState<TabId>('message')
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({})

  const activeCard =
    tab === 'all' ? null : (copy.cards.find((card) => card.id === tab) ?? copy.cards[0]!)

  const selectTab = useCallback((next: TabId) => {
    setTab(next)
    tabRefs.current[next]?.focus()
  }, [])

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, current: TabId) => {
    const index = tabIds.indexOf(current)
    if (index < 0) return
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      const delta = event.key === 'ArrowRight' ? 1 : -1
      const next = tabIds[(index + delta + tabIds.length) % tabIds.length]!
      selectTab(next)
    } else if (event.key === 'Home') {
      event.preventDefault()
      selectTab(tabIds[0]!)
    } else if (event.key === 'End') {
      event.preventDefault()
      selectTab(tabIds[tabIds.length - 1]!)
    }
  }

  const panelId = `${baseId}-panel`
  const tabButtonId = (id: TabId) => `${baseId}-tab-${id}`

  return (
    <Section
      spacing="marketing"
      tint="subtle"
      id="what-it-checks"
      className="scroll-mt-[var(--header-offset)]"
    >
      <Container className="space-y-8 sm:space-y-10">
        <LandingSectionHeader
          label={copy.label}
          brandEyebrow
          headline={copy.headlineDisplay}
          accentPeriod={copy.headlineAccentPeriod}
          subhead={copy.subhead}
        />

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
                ref={(el) => {
                  tabRefs.current[card.id] = el
                }}
                type="button"
                role="tab"
                id={tabButtonId(card.id)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => setTab(card.id)}
                onKeyDown={(e) => onTabKeyDown(e, card.id)}
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
            ref={(el) => {
              tabRefs.current.all = el
            }}
            type="button"
            role="tab"
            id={tabButtonId('all')}
            aria-selected={tab === 'all'}
            aria-controls={panelId}
            tabIndex={tab === 'all' ? 0 : -1}
            onClick={() => setTab('all')}
            onKeyDown={(e) => onTabKeyDown(e, 'all')}
            className={cn(
              'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4',
              tab === 'all'
                ? 'border-brand text-brand'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            {copy.allChecksTab}
          </button>
        </div>

        <RevealOnView>
          <div role="tabpanel" id={panelId} aria-labelledby={tabButtonId(tab)}>
            {tab === 'all' ? (
              <div className="grid gap-4 md:grid-cols-3">
                {copy.cards.map((card) => {
                  const Icon = RUBRIC_ICONS[card.icon as keyof typeof RUBRIC_ICONS]
                  return (
                    <article
                      key={card.id}
                      className="rounded-card bg-background/80 p-5 shadow-card sm:p-6"
                    >
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-background text-brand shadow-card">
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
              <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(0,0.9fr)] lg:gap-6 xl:gap-10">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-background text-brand shadow-card">
                      {(() => {
                        const Icon = RUBRIC_ICONS[activeCard.icon as keyof typeof RUBRIC_ICONS]
                        return <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      })()}
                    </span>
                    <p className="font-mono text-[0.6875rem] font-semibold uppercase tracking-label text-brand">
                      {activeCard.label}
                    </p>
                  </div>
                  <h3 className="text-xl font-semibold tracking-heading sm:text-[1.35rem]">
                    {activeCard.panelTitle}
                  </h3>
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

                <CheckDimensionsScene
                  active={activeCard.id}
                  className="order-first lg:order-none"
                />

                <div className="rounded-card bg-background p-5 shadow-card sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-semibold">{copy.topIssuesTitle}</h4>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold tabular-nums text-foreground">
                      {activeCard.topIssues.length}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-0">
                    {activeCard.topIssues.map((issue) => (
                      <li
                        key={issue.title}
                        className="border-b border-border/50 py-3 first:pt-0 last:border-0 last:pb-0"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center">
                            <SeverityIcon severity={issue.severity} />
                          </span>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-foreground text-pretty">
                                {issue.title}
                              </p>
                              <span
                                className={cn(
                                  'shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold',
                                  SEVERITY_TONE[issue.severity] ??
                                    'bg-muted text-muted-foreground'
                                )}
                              >
                                {issue.severity}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-muted-foreground text-pretty">
                              {issue.body}
                            </p>
                            <Link
                              href={issue.categoryHref}
                              className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                            >
                              /{issue.category}
                              <ArrowRight className="h-3 w-3" aria-hidden />
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={copy.viewAllIssuesHref}
                    className="mt-5 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-foreground hover:text-brand"
                  >
                    {copy.viewAllIssues}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </RevealOnView>

        <ul className="grid gap-0 overflow-hidden rounded-card bg-background/70 shadow-card sm:grid-cols-2 lg:grid-cols-4">
          {copy.values.map((item, index) => {
            const Icon = VALUE_ICONS[item.icon]
            return (
              <li
                key={item.id}
                className={cn(
                  'flex items-start gap-3.5 px-5 py-5 sm:px-5 sm:py-6',
                  index > 0 && 'border-t border-border/50 sm:border-t-0',
                  index % 2 === 1 && 'sm:border-l sm:border-border/50',
                  index > 0 && 'lg:border-l lg:border-border/50',
                  index >= 2 && 'sm:border-t sm:border-border/50 lg:border-t-0'
                )}
              >
                <ValuePedestal icon={Icon} />
                <div className="min-w-0 space-y-1 pt-0.5">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                    {item.body}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </Container>
    </Section>
  )
}
