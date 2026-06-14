import { COMPACT_DISCLAIMER, formatPipelineVersion } from '@/lib/marketing/display-meta'
import { cn } from '@/lib/utils'

interface ThirdPartyAuditDisclaimerProps {
  variant?: 'full' | 'compact'
  className?: string
  showPipeline?: boolean
}

export function ThirdPartyAuditDisclaimer({
  variant = 'full',
  className,
  showPipeline = false,
}: ThirdPartyAuditDisclaimerProps) {
  if (variant === 'compact') {
    return (
      <p className={cn('text-[10px] text-muted-foreground leading-relaxed', className)}>
        {COMPACT_DISCLAIMER}
        {showPipeline ? ` ${formatPipelineVersion()}.` : null}
      </p>
    )
  }

  return (
    <div className={cn('rounded-card border-0 bg-muted/30 p-5 space-y-3 shadow-card', className)}>
      <p className="text-sm font-medium">About these audits</p>
      <ul className="space-y-1.5 text-xs text-muted-foreground">
        <li>• All audits are automated and context-dependent — results may vary.</li>
        <li>
          • Scores reflect the {formatPipelineVersion()} model: objective checks (0–100) and
          experience grades (A–F).
        </li>
        <li>• These are not official audits or endorsements of the sites shown.</li>
        <li>• Run your own URL through the pipeline to see how your site performs.</li>
      </ul>
    </div>
  )
}
