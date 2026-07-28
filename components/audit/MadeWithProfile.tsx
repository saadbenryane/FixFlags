import {
  Activity,
  Blocks,
  Bot,
  ChartNoAxesCombined,
  ChevronDown,
  ClipboardList,
  Cloud,
  CreditCard,
  MessagesSquare,
  PanelsTopLeft,
  Shield,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/typography'
import type {
  TechnologyProfile,
  VisibleTechnology,
} from '@/lib/audit/technology-profile'
import type { GraphTechKind } from '@/lib/graph/types'
import { cn } from '@/lib/utils'
import { MADE_WITH_COPY } from '@/lib/marketing/copy'

const CATEGORY_META: Record<GraphTechKind, { label: string; icon: LucideIcon }> = {
  framework: { label: 'Framework', icon: Blocks },
  builder: { label: 'Builder', icon: Bot },
  cms: { label: 'Content', icon: PanelsTopLeft },
  commerce: { label: 'Commerce', icon: ShoppingBag },
  hosting: { label: 'Hosting', icon: Cloud },
  analytics: { label: 'Analytics', icon: ChartNoAxesCombined },
  monitoring: { label: 'Monitoring', icon: Activity },
  payments: { label: 'Payments', icon: CreditCard },
  support: { label: 'Support', icon: MessagesSquare },
  security: { label: 'Security', icon: Shield },
  form: { label: 'Forms', icon: ClipboardList },
}

function groupTechnologies(technologies: VisibleTechnology[]) {
  const groups = new Map<GraphTechKind, VisibleTechnology[]>()
  for (const technology of technologies) {
    const group = groups.get(technology.category) ?? []
    group.push(technology)
    groups.set(technology.category, group)
  }
  return [...groups.entries()]
}

function stateCopy(profile: TechnologyProfile): string | null {
  if (profile.status === 'not_captured') {
    return MADE_WITH_COPY.legacy
  }
  if (profile.status === 'unavailable') {
    return MADE_WITH_COPY.unavailable
  }
  if (profile.technologies.length === 0) {
    return MADE_WITH_COPY.empty
  }
  return null
}

export function MadeWithProfile({
  profile,
  className,
  compact = false,
}: {
  profile: TechnologyProfile
  className?: string
  compact?: boolean
}) {
  const groups = groupTechnologies(profile.technologies)
  const summary = profile.technologies.slice(0, 4)
  const emptyCopy = stateCopy(profile)

  if (compact) {
    return (
      <section
        className={cn('scroll-mt-[var(--header-offset)]', className)}
        aria-labelledby="made-with-title"
      >
        <details className="group rounded-card border border-border/45 bg-card/60 shadow-card">
          <summary className="flex min-h-11 cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-4 [&::-webkit-details-marker]:hidden">
            <h2 id="made-with-title" className="text-xs font-medium text-muted-foreground">
              {MADE_WITH_COPY.title}
            </h2>
            {summary.map((technology) => (
              <span
                key={technology.slug}
                className="rounded-full bg-muted/70 px-2 py-1 text-xs font-medium text-foreground"
              >
                {technology.name}
              </span>
            ))}
            {profile.technologies.length > summary.length ? (
              <span className="font-mono text-2xs text-muted-foreground">
                +{profile.technologies.length - summary.length}
              </span>
            ) : null}
            {emptyCopy ? (
              <span className="text-xs text-muted-foreground">{emptyCopy}</span>
            ) : null}
            <ChevronDown
              className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
              aria-hidden
            />
          </summary>
          <div className="space-y-3 border-t border-border/35 px-4 py-3">
            {groups.map(([category, technologies]) => {
              const meta = CATEGORY_META[category]
              const Icon = meta.icon
              return (
                <div key={category} className="grid gap-2 sm:grid-cols-[8rem_1fr]">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden />
                    {meta.label}
                  </div>
                  <p className="text-xs text-foreground">
                    {technologies.map((technology) => technology.name).join(', ')}
                  </p>
                </div>
              )
            })}
            <p className="text-2xs leading-relaxed text-muted-foreground">
              {MADE_WITH_COPY.disclaimer}
            </p>
          </div>
        </details>
      </section>
    )
  }

  return (
    <section
      className={cn('scroll-mt-[var(--header-offset)]', className)}
      aria-labelledby="made-with-title"
    >
      <Card className="overflow-hidden p-0">
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="section-label mb-2">{MADE_WITH_COPY.sectionLabel}</p>
              <SectionTitle id="made-with-title">
                {MADE_WITH_COPY.title}
              </SectionTitle>
            </div>
            {profile.detectedAt ? (
              <time
                dateTime={profile.detectedAt}
                className="font-mono text-xs text-muted-foreground"
              >
                {MADE_WITH_COPY.checked} {new Date(profile.detectedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </time>
            ) : null}
          </div>

          {summary.length > 0 ? (
            <div className="flex flex-wrap gap-2" aria-label="Primary detected technologies">
              {summary.map((technology) => (
                <span
                  key={technology.slug}
                  className="rounded-full bg-muted/70 px-3 py-1.5 text-sm font-medium text-foreground shadow-sm"
                >
                  {technology.name}
                </span>
              ))}
              {profile.technologies.length > summary.length ? (
                <span className="px-1 py-1.5 font-mono text-xs text-muted-foreground">
                  +{profile.technologies.length - summary.length}
                </span>
              ) : null}
            </div>
          ) : null}

          {profile.insight ? (
            <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">
              {profile.insight}
            </p>
          ) : null}

          {emptyCopy ? (
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {emptyCopy}
            </p>
          ) : null}

          {profile.status === 'partial' ? (
            <p className="text-xs text-muted-foreground">
              {MADE_WITH_COPY.partial}
            </p>
          ) : null}
        </div>

        {groups.length > 0 ? (
          <details className="group border-t border-border/35">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-medium outline-none transition-colors duration-200 hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-6 [&::-webkit-details-marker]:hidden">
              <span>{MADE_WITH_COPY.viewEvidence}</span>
              <ChevronDown
                className="size-4 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </summary>
            <div className="space-y-5 bg-muted/20 px-5 pb-5 pt-2 sm:px-6 sm:pb-6">
              {groups.map(([category, technologies]) => {
                const meta = CATEGORY_META[category]
                const Icon = meta.icon
                return (
                  <div key={category} className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {meta.label}
                    </div>
                    <div className="space-y-2">
                      {technologies.map((technology) => (
                        <div
                          key={technology.slug}
                          className="rounded-nested-md bg-background/70 p-3 shadow-sm"
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="font-medium text-foreground">{technology.name}</span>
                            <span className="font-mono text-xs text-muted-foreground">
                              {technology.confidenceBand === 'verified'
                                ? MADE_WITH_COPY.verified
                                : MADE_WITH_COPY.strongSignal}
                            </span>
                          </div>
                          {technology.evidence.length > 0 ? (
                            <ul className="mt-2 space-y-1">
                              {technology.evidence.map((evidence) => (
                                <li
                                  key={`${evidence.type}:${evidence.label}`}
                                  className="font-mono text-xs leading-relaxed text-muted-foreground"
                                >
                                  {evidence.label}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {profile.recheckDiff ? (
                <div className="rounded-nested-md bg-background/70 p-4 shadow-sm">
                  <p className="text-sm font-medium text-foreground">{MADE_WITH_COPY.changed}</p>
                  <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {profile.recheckDiff.added.length > 0 ? (
                      <p>{MADE_WITH_COPY.added}: {profile.recheckDiff.added.join(', ')}</p>
                    ) : null}
                    {profile.recheckDiff.removed.length > 0 ? (
                      <p>{MADE_WITH_COPY.removed}: {profile.recheckDiff.removed.join(', ')}</p>
                    ) : null}
                    {profile.recheckDiff.confidenceChanged.length > 0 ? (
                      <p>{MADE_WITH_COPY.evidenceChanged}: {profile.recheckDiff.confidenceChanged.join(', ')}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <p className="text-xs leading-relaxed text-muted-foreground">
                {MADE_WITH_COPY.disclaimer}
              </p>
            </div>
          </details>
        ) : null}
      </Card>
    </section>
  )
}
