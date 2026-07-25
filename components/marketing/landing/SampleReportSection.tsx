import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  ChevronRight,
  Crosshair,
  Lock,
  RefreshCw,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RUBRIC_ICONS } from '@/components/marketing/landing/rubric-icons'
import {
  SampleSectionCta,
  SampleViewTracker,
} from '@/components/marketing/landing/SampleFunnelEvents'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { CHECK_ID_COUNT } from '@/lib/audit/check-ids'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'

const HeroProductPreview = dynamic(
  () =>
    import('@/components/marketing/landing/HeroProductPreview').then(
      (m) => m.HeroProductPreview
    ),
  {
    ssr: true,
    loading: () => (
      <div
        aria-hidden
        className="aspect-[16/10] w-full animate-pulse rounded-card bg-muted/40 shadow-card"
      />
    ),
  }
)

const TRUST_ICONS = {
  zap: Zap,
  refresh: RefreshCw,
  lock: Lock,
  shield: ShieldCheck,
  target: Crosshair,
} as const

interface SampleReportSectionProps {
  audit?: LiveSampleAudit
  illustrative?: boolean
}

export function SampleReportSection({ audit, illustrative = false }: SampleReportSectionProps) {
  const copy = LANDING_PAGE.sampleReport
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit())
  const model = buildSampleExplorerModel(report)
  const flagCount = report.flagCount

  const rubricCounts = {
    message: report.flags.filter((f) => f.rubric === 'MESSAGE').length,
    experience: report.flags.filter((f) => f.rubric === 'EXPERIENCE').length,
    reach: report.flags.filter((f) => f.rubric === 'REACH').length,
  } as const

  return (
    <Section
      spacing="marketing"
      id="sample-review"
      className="scroll-mt-[var(--header-offset)] bg-muted/25"
    >
      <SampleViewTracker placement="homepage" />
      <Container className="space-y-10 sm:space-y-12">
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.15fr)] lg:gap-12 xl:gap-14">
          <RevealOnView className="space-y-6 sm:space-y-7">
            <LandingSectionHeader
              align="left"
              headline={copy.headlineDisplay}
              accentPeriod={copy.headlineAccentPeriod}
              subhead={copy.body}
              headlineClassName="max-w-[16ch] text-[1.75rem] sm:text-[2rem] md:text-[2.25rem]"
              className="max-w-md space-y-3.5"
            />
            {illustrative && copy.illustrativeLabel ? (
              <p className="section-label">{copy.illustrativeLabel}</p>
            ) : null}

            <ul className="divide-y divide-border/60 border-y border-border/60">
              {copy.rubricRows.map((row) => {
                const Icon = RUBRIC_ICONS[row.icon]
                const count = rubricCounts[row.id as keyof typeof rubricCounts] ?? 0
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

          <div className="relative motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-delay:160ms] motion-safe:[animation-fill-mode:forwards]">
            <HeroProductPreview model={model} className="max-w-none" />
          </div>
        </div>

        <RevealOnView>
          <div className="rounded-card bg-muted/55 px-5 py-6 sm:px-8 sm:py-7">
            <p className="text-center font-mono text-[0.6875rem] font-medium uppercase tracking-label text-muted-foreground">
              {copy.trustLabel}
            </p>
            <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
              <TrustChip icon={ShieldCheck} label={copy.checksLabel(CHECK_ID_COUNT)} />
              <TrustChip icon={Crosshair} label={copy.issuesLabel(flagCount)} />
              {copy.trustChips.map((chip) => {
                const Icon = TRUST_ICONS[chip.icon]
                return <TrustChip key={chip.id} icon={Icon} label={chip.label} />
              })}
            </ul>
          </div>
        </RevealOnView>
      </Container>
    </Section>
  )
}

function TrustChip({
  icon: Icon,
  label,
}: {
  icon: typeof ShieldCheck
  label: string
}) {
  return (
    <li className="flex items-start gap-2.5 text-left sm:justify-center sm:text-center lg:flex-col lg:items-center">
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-brand/10 text-brand">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="text-sm font-medium leading-snug text-foreground text-pretty">{label}</span>
    </li>
  )
}
