import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { cn } from '@/lib/utils'

interface ThirdPartyAuditDisclaimerProps {
  variant?: 'full' | 'compact'
  className?: string
}

export function ThirdPartyAuditDisclaimer({
  variant = 'full',
  className,
}: ThirdPartyAuditDisclaimerProps) {
  if (variant === 'compact') {
    return (
      <p className={cn('text-[10px] text-muted-foreground leading-relaxed', className)}>
        Automated audit — illustrative, not an endorsement. Pipeline v{PIPELINE_VERSION}.
      </p>
    )
  }

  return (
    <div className={cn('rounded-lg border bg-muted/30 p-5 space-y-3', className)}>
      <p className="text-sm font-medium">About these audits</p>
      <ul className="text-xs text-muted-foreground space-y-1.5">
        <li>• All audits are automated and context-dependent — results may vary.</li>
        <li>
          • Scores reflect the pipeline v{PIPELINE_VERSION} model: objective checks (0–100) and
          experience grades (A–F).
        </li>
        <li>• These are not official audits or endorsements of the sites shown.</li>
        <li>• Run your own URL through the pipeline to see how your site performs.</li>
      </ul>
    </div>
  )
}
