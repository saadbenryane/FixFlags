import { ImageIcon } from 'lucide-react'
import { SampleReportExplorer } from '@/components/marketing/sample/SampleReportExplorer'
import { LANDING_PAGE } from '@/lib/marketing/copy'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import { cn } from '@/lib/utils'

interface HeroProductPreviewProps {
  className?: string
  model: ReportExplorerModel
}

export function HeroProductPreview({ className, model }: HeroProductPreviewProps) {
  const { previewEyebrow, previewTitle, previewBadge } = LANDING_PAGE.sampleReport

  return (
    <div className={cn('relative mx-auto w-full max-w-5xl', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,hsl(var(--foreground)/0.04),transparent_68%)]"
      />
      <div className="overflow-clip rounded-card glass-surface shadow-2xl">
        <div className="border-b border-border/30 bg-card/70 px-5 py-4 sm:px-6 sm:py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="section-label">{previewEyebrow}</p>
              <h3 className="mt-1 font-serif text-xl font-medium tracking-display sm:text-2xl">
                {previewTitle}
              </h3>
            </div>
            <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-success/10 px-3 py-1.5 text-xs font-medium text-success">
              <ImageIcon className="h-3.5 w-3.5" aria-hidden />
              {previewBadge}
            </span>
          </div>
        </div>
        <SampleReportExplorer
          model={model}
          variant="hero"
          className="rounded-none bg-transparent shadow-none"
        />
      </div>
    </div>
  )
}
