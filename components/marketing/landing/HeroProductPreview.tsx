import { SampleReportExplorer } from '@/components/marketing/sample/SampleReportExplorer'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import { cn } from '@/lib/utils'

interface HeroProductPreviewProps {
  className?: string
  model: ReportExplorerModel
}

export function HeroProductPreview({ className, model }: HeroProductPreviewProps) {
  return (
    <div className={cn('relative mx-auto w-full max-w-5xl', className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-4 -z-10 rounded-3xl bg-[radial-gradient(ellipse_80%_60%_at_50%_60%,hsl(var(--foreground)/0.04),transparent_68%)]"
      />
      <div className="overflow-clip rounded-card glass-surface shadow-2xl">
        <SampleReportExplorer
          model={model}
          variant="hero"
          className="rounded-none bg-transparent shadow-none"
        />
      </div>
    </div>
  )
}
