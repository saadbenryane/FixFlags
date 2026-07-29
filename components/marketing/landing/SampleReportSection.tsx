import Link from 'next/link'
import {
  ChevronRight,
  Flag,
  LockKeyhole,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Timer,
} from 'lucide-react'
import { HomepageReportPreview } from '@/components/marketing/landing/HomepageReportPreview'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { rubricIcon } from '@/lib/rubric-icons'
import {
  SampleSectionCta,
  SampleViewTracker,
} from '@/components/marketing/landing/SampleFunnelEvents'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import type { CuratedSampleAudit } from '@/lib/marketing/curated-sample'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import { buildCuratedSampleWorkspaceModel } from '@/lib/report/workspace-adapters'
import { cn } from '@/lib/utils'

interface SampleReportSectionProps {
  audit?: CuratedSampleAudit
}

export function SampleReportSection({ audit }: SampleReportSectionProps) {
  const copy = LANDING_PAGE.sampleReport
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit())
  const workspace = buildCuratedSampleWorkspaceModel(report)
  const flagCount = report.flags.length
  const metrics = [
    {
      id: 'checks',
      ...copy.checksMetric(CHECK_ID_COUNT),
      icon: ShieldCheck,
    },
    {
      id: 'flags',
      ...copy.issuesMetric(flagCount),
      icon: Flag,
    },
    ...copy.trustMetrics.map((metric) => ({
      ...metric,
      icon:
        metric.id === 'speed'
          ? Timer
          : metric.id === 'recheck'
            ? RefreshCw
            : metric.id === 'private'
              ? LockKeyhole
              : ScanSearch,
    })),
  ]

  return (
    <Section
      spacing="marketing"
      tint="subtle"
      className="overflow-hidden py-14 sm:py-16 lg:py-20"
    >
      <SampleViewTracker placement="homepage" />
      <Container
        id="sample-review"
        className="scroll-mt-[calc(var(--header-height-marketing)+1rem)] space-y-10 px-4 sm:space-y-12 sm:px-6 lg:px-12"
        variant="marketing"
      >
        <div className="grid items-center gap-9 lg:grid-cols-[minmax(18rem,0.58fr)_minmax(0,1.42fr)] lg:gap-9 xl:gap-12">
          <RevealOnView className="flex flex-col gap-5 sm:gap-6">
            <LandingSectionHeader
              align="left"
              label={copy.label}
              brandEyebrow
              headline={copy.headlineDisplay}
              accentPeriod={copy.headlineAccentPeriod}
              subhead={copy.body}
              size="lg"
              className="max-w-md space-y-4 sm:space-y-5"
            />

            <ul className="flex flex-col divide-y divide-border/45">
              {copy.rubricRows.map((row) => {
                const Icon = rubricIcon(row.icon)
                const count = report.flags.filter(
                  (flag) => flag.rubric.toLowerCase() === row.id
                ).length
                return (
                  <li key={row.id}>
                    <Link
                      href="/samples"
                      className={cn(
                        'group flex min-h-[4.25rem] items-center gap-3.5 rounded-[var(--radius-control)] px-1 py-2.5 sm:gap-4',
                        'transition-[background-color,transform] duration-200 ease-out',
                        'hover:bg-background/75',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
                      )}
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center text-brand">
                        <Icon className="h-5 w-5" strokeWidth={1.7} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.9375rem] font-semibold text-foreground">
                          {row.title}
                        </span>
                        <span className="mt-1 block text-[0.8125rem] leading-snug text-muted-foreground text-pretty">
                          {row.body}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2 pl-1">
                        <span className="text-[0.6875rem] font-medium tabular-nums text-brand/70">
                          {count} {count === 1 ? 'Flag' : 'Flags'}
                        </span>
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground/70 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:text-foreground"
                          aria-hidden
                        />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>

            <SampleSectionCta flagCount={flagCount} />
          </RevealOnView>

          <RevealOnView className="min-w-0">
            <HomepageReportPreview model={workspace} />
          </RevealOnView>
        </div>

        <RevealOnView>
          <div className="overflow-hidden rounded-[var(--radius-inner)] bg-background/75 shadow-card ring-1 ring-border/45">
            <p className="border-b border-border/40 px-5 py-3 text-center font-mono text-3xs font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-2xs">
              {copy.trustLabel}
            </p>
            <dl className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
              {metrics.map((metric, index) => {
                const Icon = metric.icon
                return (
                  <div
                    key={metric.id}
                    className={cn(
                      'flex min-h-24 items-center gap-3 px-4 py-4 sm:px-5',
                      index % 2 !== 0 && 'border-l border-border/35',
                      index >= 2 && 'border-t border-border/35 md:border-t-0',
                      index % 3 !== 0 && 'md:border-l md:border-border/35',
                      index >= 3 && 'md:border-t md:border-border/35 xl:border-t-0',
                      index > 0 && 'xl:border-l xl:border-border/35'
                    )}
                  >
                    <Icon
                      className={cn(
                        'h-5 w-5 shrink-0',
                        metric.id === 'flags' ? 'text-brand' : 'text-foreground'
                      )}
                      strokeWidth={1.7}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <dt className="truncate text-xs text-muted-foreground">
                        {metric.label}
                      </dt>
                      <dd className="mt-1 font-mono text-base font-semibold tabular-nums text-foreground">
                        {metric.value}
                      </dd>
                    </div>
                  </div>
                )
              })}
            </dl>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}
