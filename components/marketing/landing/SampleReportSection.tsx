import Link from 'next/link'
import {
  ChevronRight,
  Crosshair,
  Lock,
  RefreshCw,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { rubricIcon } from '@/lib/rubric-icons'
import { SampleReportDashboardMock } from '@/components/marketing/landing/SampleReportDashboardMock'
import {
  SampleSectionCta,
  SampleViewTracker,
} from '@/components/marketing/landing/SampleFunnelEvents'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import { buildSampleDashboardPreview } from '@/lib/marketing/sample-dashboard-preview'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

const TRUST_ICONS = {
  zap: Zap,
  refresh: RefreshCw,
  lock: Lock,
  shield: ShieldCheck,
  target: Crosshair,
  users: Users,
} as const

interface SampleReportSectionProps {
  audit?: LiveSampleAudit
}

export function SampleReportSection({ audit }: SampleReportSectionProps) {
  const copy = LANDING_PAGE.sampleReport
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit())
  const preview = buildSampleDashboardPreview(report)
  const flagCount = preview.flagCount

  return (
    <Section
      spacing="compact"
      tint="subtle"
      className="py-6 sm:py-7 lg:py-7"
    >
      <SampleViewTracker placement="homepage" />
      <Container
        id="sample-review"
        className="scroll-mt-[calc(var(--header-height-marketing)+1rem)] space-y-5 px-4 sm:space-y-5 sm:px-6 lg:space-y-5 lg:px-12"
        variant="marketing"
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.64fr)_minmax(0,1.36fr)] lg:gap-7 xl:gap-9">
          <RevealOnView className="flex flex-col gap-3.5 sm:gap-4">
            <LandingSectionHeader
              align="left"
              label={copy.label}
              brandEyebrow
              headline={copy.headlineDisplay}
              accentPeriod={copy.headlineAccentPeriod}
              subhead={copy.body}
              size="lg"
              className="max-w-md space-y-3 sm:space-y-4"
            />

            <ul className="flex flex-col gap-1.5">
              {copy.rubricRows.map((row) => {
                const Icon = rubricIcon(row.icon)
                const count = preview.rubricCounts[row.id as keyof typeof preview.rubricCounts] ?? 0
                return (
                  <li key={row.id}>
                    <Link
                      href="/samples"
                      className={cn(
                        'group flex min-h-11 items-center gap-3 rounded-[var(--radius-inner)] border border-border/45 bg-background/90 px-3.5 py-1.5 sm:px-4',
                        'shadow-glass-subtle',
                        'transition-[background-color,box-shadow,border-color,transform] duration-200 ease-out',
                        'hover:border-border/65 hover:bg-background hover:shadow-glass',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
                      )}
                    >
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand/10 text-brand">
                        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {row.title}
                        </span>
                        <span className="mt-0.5 block text-xs leading-snug text-muted-foreground text-pretty">
                          {row.body}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-2 pl-1">
                        <span className="text-[0.6875rem] font-medium tabular-nums text-brand/70">
                          {count} {count === 1 ? 'issue' : 'issues'}
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

          <div className="relative min-w-0 lg:aspect-[1.62/1]">
            <SampleReportDashboardMock
              preview={preview}
              checksLabel={copy.checksShortLabel(CHECK_ID_COUNT)}
              className="lg:absolute lg:left-0 lg:top-0 lg:w-[161.3%] lg:origin-top-left lg:scale-[0.62]"
            />
          </div>
        </div>

        <RevealOnView>
          <div className="space-y-2.5">
            <p className="text-center font-mono text-[0.6875rem] font-medium uppercase tracking-label text-muted-foreground">
              {copy.trustLabel}
            </p>
            <ul className="grid grid-cols-1 gap-4 overflow-hidden rounded-[1.35rem] glass-surface-elevated px-5 py-4 sm:grid-cols-2 sm:gap-5 sm:px-6 sm:py-4 md:grid-cols-3 lg:grid-cols-6 lg:items-stretch lg:gap-0 lg:px-3 lg:py-3 xl:px-5">
              <TrustMetric
                icon={ShieldCheck}
                value={copy.checksMetric(CHECK_ID_COUNT).value}
                label={copy.checksMetric(CHECK_ID_COUNT).label}
              />
              <TrustMetric
                icon={Crosshair}
                value={copy.issuesMetric(flagCount).value}
                label={copy.issuesMetric(flagCount).label}
                divider
              />
              {copy.trustMetrics.map((metric) => {
                const Icon = TRUST_ICONS[metric.icon]
                return (
                  <TrustMetric
                    key={metric.id}
                    icon={Icon}
                    value={metric.value}
                    label={metric.label}
                    divider
                  />
                )
              })}
            </ul>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}

function TrustMetric({
  icon: Icon,
  value,
  label,
  divider = false,
}: {
  icon: typeof ShieldCheck
  value: string
  label: string
  divider?: boolean
}) {
  return (
    <li
      className={cn(
        'flex items-start gap-3 text-left sm:flex-col sm:items-center sm:px-2 sm:text-center lg:px-4 lg:py-1 xl:px-5',
        divider && 'lg:border-l lg:border-border/45'
      )}
    >
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand/10 text-brand">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[0.9375rem] font-semibold leading-tight tabular-nums text-foreground sm:text-base">
          {value}
        </span>
        <span className="mt-1 block text-xs leading-snug text-muted-foreground text-pretty">
          {label}
        </span>
      </span>
    </li>
  )
}
