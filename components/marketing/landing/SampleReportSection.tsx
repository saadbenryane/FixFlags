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
import { RUBRIC_ICONS } from '@/components/marketing/landing/rubric-icons'
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
      spacing="marketing"
      id="sample-review"
      className="scroll-mt-[var(--header-offset)] bg-muted/25"
    >
      <SampleViewTracker placement="homepage" />
      <Container className="space-y-10 sm:space-y-12" variant="wide">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:gap-10 xl:gap-12">
          <RevealOnView className="space-y-6 sm:space-y-7">
            <LandingSectionHeader
              align="left"
              label={copy.label}
              brandEyebrow
              headline={copy.headlineDisplay}
              accentPeriod={copy.headlineAccentPeriod}
              subhead={copy.body}
              headlineClassName="max-w-[16ch] text-[1.75rem] sm:text-[2rem] md:text-[2.25rem]"
              className="max-w-md space-y-3.5"
            />

            <ul className="divide-y divide-border/60 border-y border-border/60">
              {copy.rubricRows.map((row) => {
                const Icon = RUBRIC_ICONS[row.icon]
                const count = preview.rubricCounts[row.id as keyof typeof preview.rubricCounts] ?? 0
                return (
                  <li key={row.id}>
                    <Link
                      href="/samples"
                      className="group flex items-center gap-3 py-3.5 transition-colors hover:bg-background/40 sm:gap-4"
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand/10 text-brand">
                        <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {row.title}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted-foreground text-pretty">
                          {row.body}
                        </span>
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-brand">
                        {count} {count === 1 ? 'issue' : 'issues'}
                        <ChevronRight
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
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

          <div className="relative">
            <SampleReportDashboardMock
              preview={preview}
              checksLabel={copy.checksShortLabel(CHECK_ID_COUNT)}
            />
          </div>
        </div>

        <RevealOnView>
          <div className="rounded-card bg-muted/55 px-5 py-6 sm:px-8 sm:py-7">
            <p className="text-center font-mono text-[0.6875rem] font-medium uppercase tracking-label text-muted-foreground">
              {copy.trustLabel}
            </p>
            <ul className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:gap-3">
              <TrustMetric
                icon={ShieldCheck}
                value={copy.checksMetric(CHECK_ID_COUNT).value}
                label={copy.checksMetric(CHECK_ID_COUNT).label}
              />
              <TrustMetric
                icon={Crosshair}
                value={copy.issuesMetric(flagCount).value}
                label={copy.issuesMetric(flagCount).label}
              />
              {copy.trustMetrics.map((metric) => {
                const Icon = TRUST_ICONS[metric.icon]
                return (
                  <TrustMetric
                    key={metric.id}
                    icon={Icon}
                    value={metric.value}
                    label={metric.label}
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
}: {
  icon: typeof ShieldCheck
  value: string
  label: string
}) {
  return (
    <li className="flex items-start gap-2.5 text-left sm:flex-col sm:items-center sm:text-center">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand/10 text-brand">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold tabular-nums text-foreground">{value}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground text-pretty">{label}</span>
      </span>
    </li>
  )
}
