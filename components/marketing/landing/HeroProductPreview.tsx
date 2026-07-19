'use client'

import dynamic from 'next/dynamic'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import { cn } from '@/lib/cn'

const SampleReportExplorer = dynamic(
  () =>
    import('@/components/marketing/sample/SampleReportExplorer').then(
      (m) => m.SampleReportExplorer
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

interface HeroProductPreviewProps {
  className?: string
  /** Prebuilt on the server so audit/scoring libs stay out of the marketing client graph. */
  model: ReportExplorerModel
}

export function HeroProductPreview({ className, model }: HeroProductPreviewProps) {
  return (
    <div className={cn('relative mx-auto w-full max-w-5xl', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,hsl(var(--foreground)/0.04),transparent_68%)]"
      />
      <SampleReportExplorer model={model} variant="hero" />
    </div>
  )
}
