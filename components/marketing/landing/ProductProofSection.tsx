import dynamic from 'next/dynamic'
import { CheckCircle2, MessageSquare, Zap, Globe2 } from 'lucide-react'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { RevealOnView } from '@/components/marketing/landing/RevealOnView'
import { SampleSectionCta, SampleViewTracker } from '@/components/marketing/landing/SampleFunnelEvents'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
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
        className="mx-auto aspect-[16/10] w-full max-w-5xl animate-pulse rounded-card bg-muted/40 shadow-card"
      />
    ),
  }
)

const ICONS = {
  message: MessageSquare,
  experience: Zap,
  reach: Globe2,
} as const

interface ProductProofSectionProps {
  audit?: LiveSampleAudit
  illustrative?: boolean
}

export function ProductProofSection({ audit, illustrative = false }: ProductProofSectionProps) {
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit())
  const model = buildSampleExplorerModel(report)
  const flagCount = report.flagCount

  return (
    <Section spacing="marketing" id="sample-review" className="scroll-mt-[var(--header-offset)] bg-muted/20">
      <SampleViewTracker placement="homepage" />
      <Container className="space-y-8 sm:space-y-11">
        <RevealOnView>
          <div className="mx-auto max-w-3xl space-y-3 text-center">
            <LandingSectionHeader headline="What a review actually catches." />
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {LANDING_PAGE.productEvidence.subhead}
            </p>
            {illustrative ? (
              <p className="mx-auto mt-2 text-center section-label">
                {LANDING_PAGE.sampleReport.illustrativeLabel}
              </p>
            ) : null}
          </div>
        </RevealOnView>

        <div className="relative motion-safe:animate-fade-in-up motion-safe:opacity-0 motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:forwards]">
          <HeroProductPreview model={model} />
        </div>

        <SampleSectionCta flagCount={flagCount} />

        <RevealOnView>
          <ul className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3 sm:gap-5">
            {LANDING_PAGE.productEvidence.items.map((item) => {
              const Icon = ICONS[item.id as keyof typeof ICONS] ?? MessageSquare
              return (
                <li
                  key={item.id}
                  className="rounded-card p-5 glass-surface shadow-card sm:p-6"
                >
                  <Icon className="h-5 w-5 text-brand" aria-hidden />
                  <h3 className="mt-3 font-serif text-lg font-medium tracking-heading text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
                    {item.lead}
                  </p>
                  <ul className="mt-4 space-y-2.5">
                    {item.findings.map((finding) => (
                      <li key={finding} className="flex items-start gap-2.5 text-sm leading-snug">
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                          aria-hidden
                        />
                        <span className="text-pretty text-foreground">{finding}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              )
            })}
          </ul>
        </RevealOnView>
      </Container>
    </Section>
  )
}
