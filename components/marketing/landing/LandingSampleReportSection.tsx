import { ArrowRight } from 'lucide-react'
import { SampleReportExplorer } from '@/components/marketing/sample/SampleReportExplorer'
import { Container } from '@/components/ui/container'
import { Section } from '@/components/ui/section'
import { LandingSectionHeader } from '@/components/marketing/landing/LandingSectionHeader'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import type { SampleSource } from '@/lib/marketing/live-sample'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import Link from 'next/link'

interface LandingSampleReportSectionProps {
  audit: LiveSampleAudit
  sampleHref?: string
  source?: SampleSource
}

export function LandingSampleReportSection({
  audit,
  sampleHref = '/samples',
  source = 'static',
}: LandingSampleReportSectionProps) {
  const { label, headline, body, cta, illustrativeLabel } = LANDING_PAGE.sampleReport
  const report = buildSampleReportDisplay(audit)

  return (
    <Section spacing="marketing" id="sample-report" className="scroll-mt-[var(--header-offset)]">
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div className="space-y-6 lg:sticky lg:top-[calc(var(--header-offset)+1.5rem)]">
            <LandingSectionHeader label={label} headline={headline} align="left" />
            <p className="max-w-prose text-base leading-relaxed text-muted-foreground">{body}</p>
            <Link
              href={sampleHref}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition-colors hover:text-brand-hover"
            >
              {cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            {source === 'static' && (
              <p className="text-[11px] text-muted-foreground/70">{illustrativeLabel}</p>
            )}
          </div>

          <SampleReportExplorer report={report} variant="embedded" />
        </div>
      </Container>
    </Section>
  )
}
