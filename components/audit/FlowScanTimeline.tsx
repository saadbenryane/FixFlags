import type { FlowData } from '@/lib/audit/flow-data'
import { FLOW_SCAN_STATUS } from '@/lib/marketing/copy'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  flowData: FlowData
}

function statusCopy(status: string): { label: string; description: string } {
  const entry = FLOW_SCAN_STATUS[status as keyof typeof FLOW_SCAN_STATUS]
  if (entry) return entry
  return {
    label: status.replace(/_/g, ' '),
    description: 'Flow scan did not complete successfully.',
  }
}

export function FlowScanTimeline({ flowData }: Props) {
  const status = statusCopy(flowData.status)
  const hasSteps = flowData.steps.length > 0

  return (
    <section
      id="report-flow"
      className="scroll-mt-[var(--header-offset)] space-y-3"
      aria-labelledby="flow-scan-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id="flow-scan-heading" className="text-sm font-semibold tracking-heading">
            CTA flow test
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            FixFlags clicked your primary CTA and captured each step.
            {flowData.ctaText ? ` Target: "${flowData.ctaText}".` : null}
          </p>
        </div>
        {flowData.status !== 'success' && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              'bg-muted text-foreground'
            )}
          >
            {status.label}
          </span>
        )}
      </div>

      {!hasSteps ? (
        <div className="rounded-card border-0 bg-card p-4 shadow-card text-sm text-muted-foreground">
          {status.description}
        </div>
      ) : (
        <ol className="flex flex-col sm:flex-row sm:items-start gap-4">
          {flowData.steps.map((step, index) => (
            <li
              key={`${step.label}-${index}`}
              className="flex sm:flex-col items-start gap-3 flex-1 min-w-0"
            >
              {index > 0 && (
                <ArrowRight
                  className="hidden sm:block h-4 w-4 text-muted-foreground shrink-0 mt-24"
                  aria-hidden
                />
              )}
              <div className="flex-1 min-w-0 space-y-2 w-full">
                <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                <div className="rounded-card bg-card shadow-card overflow-hidden">
                  {step.screenshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={step.screenshotUrl}
                      alt={step.label}
                      className="w-full aspect-video object-cover object-top bg-muted"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-muted flex items-center justify-center text-xs text-muted-foreground">
                      No capture
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground truncate font-mono">{step.url}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {hasSteps && flowData.status !== 'success' && (
        <p className="text-sm text-muted-foreground">{status.description}</p>
      )}
    </section>
  )
}
