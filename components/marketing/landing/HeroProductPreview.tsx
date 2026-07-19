'use client'

import { SampleReportExplorer } from '@/components/marketing/sample/SampleReportExplorer'
import { buildSampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { getStaticSampleAudit } from '@/lib/marketing/static-sample'
import type { LiveSampleAudit } from '@/lib/marketing/live-sample'
import { cn } from '@/lib/utils'

interface HeroProductPreviewProps {
  className?: string
  /** Optional live audit; falls back to static sample for a consistent hero demo */
  audit?: LiveSampleAudit
}

export function HeroProductPreview({ className, audit }: HeroProductPreviewProps) {
  const report = buildSampleReportDisplay(audit ?? getStaticSampleAudit(), {
    flagshipOnly: true,
  })

  return (
    <div className={cn('relative mx-auto w-full max-w-5xl', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,hsl(var(--foreground)/0.04),transparent_68%)]"
      />
      <SampleReportExplorer report={report} variant="hero" />
    </div>
  )
}
