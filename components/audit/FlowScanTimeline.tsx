import type { FlowData } from '@/lib/audit/flow-data'
import { ArrowRight } from 'lucide-react'

interface Props {
  flowData: FlowData
}

export function FlowScanTimeline({ flowData }: Props) {
  if (flowData.steps.length === 0) return null

  return (
    <section
      id="report-flow"
      className="scroll-mt-[var(--header-offset)] space-y-3"
      aria-labelledby="flow-scan-heading"
    >
      <div>
        <h2 id="flow-scan-heading" className="text-sm font-semibold tracking-heading">
          CTA flow test
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          FixFlags clicked your primary CTA and captured each step.
          {flowData.ctaText ? ` Target: "${flowData.ctaText}".` : null}
        </p>
      </div>
      <ol className="flex flex-col sm:flex-row sm:items-start gap-4">
        {flowData.steps.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex sm:flex-col items-start gap-3 flex-1 min-w-0">
            {index > 0 && (
              <ArrowRight className="hidden sm:block h-4 w-4 text-muted-foreground shrink-0 mt-24" aria-hidden />
            )}
            <div className="flex-1 min-w-0 space-y-2 w-full">
              <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
              {step.screenshotUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={step.screenshotUrl}
                  alt={step.label}
                  className="w-full rounded-lg border shadow-sm aspect-video object-cover object-top bg-muted"
                />
              ) : (
                <div className="w-full rounded-lg border aspect-video bg-muted flex items-center justify-center text-xs text-muted-foreground">
                  No capture
                </div>
              )}
              <p className="text-[10px] text-muted-foreground truncate font-mono">{step.url}</p>
            </div>
          </li>
        ))}
      </ol>
      {flowData.status !== 'success' && (
        <p className="text-sm text-muted-foreground">
          Flow result: <span className="font-medium text-foreground">{flowData.status.replace(/_/g, ' ')}</span>
        </p>
      )}
    </section>
  )
}
