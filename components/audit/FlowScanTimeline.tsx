import type { FlowData } from '@/lib/audit/flow-data'
import { FLOW_SCAN_STATUS, REPORT_COPY } from '@/lib/marketing/copy'
import { Card } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/typography'
import { ArrowRight } from 'lucide-react'
import { normalizeInternalScreenshotUrl } from '@/lib/audit/screenshot-types'
import { cn } from '@/lib/utils'
import { displayEvidenceUrl } from '@/lib/utils/url-helpers'

interface Props {
  flowData: FlowData
}

function statusCopy(status: string): { label: string; description: string } {
  const entry = FLOW_SCAN_STATUS[status as keyof typeof FLOW_SCAN_STATUS]
  if (entry) return entry
  return {
    label: status.replace(/_/g, ' '),
    description: 'The CTA flow test did not complete successfully.',
  }
}

export function FlowScanTimeline({ flowData }: Props) {
  const status = statusCopy(flowData.status)
  const hasSteps = flowData.steps.length > 0
  const ctaHrefLabel = displayEvidenceUrl(flowData.ctaHref)

  return (
    <section
      id="report-flow"
      className="scroll-mt-[var(--header-offset)] space-y-3"
      aria-labelledby="flow-scan-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <SectionTitle id="flow-scan-heading">{REPORT_COPY.sectionTitles.flow}</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            FixFlags clicked your primary CTA and captured each step.
            {flowData.ctaText ? ` Target: "${flowData.ctaText}"` : null}
            {ctaHrefLabel ? ` → ${ctaHrefLabel}` : null}.
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
        <Card className="p-4 text-sm text-muted-foreground">{status.description}</Card>
      ) : (
        <ol className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {flowData.steps.map((step, index) => {
            const screenshotUrl = step.screenshotUrl
              ? normalizeInternalScreenshotUrl(step.screenshotUrl)
              : null

            return (
              <li
                key={`${step.label}-${index}`}
                className="flex min-w-0 flex-1 items-start gap-3 sm:flex-col"
              >
                {index > 0 && (
                  <ArrowRight
                    className="mt-24 hidden h-4 w-4 shrink-0 text-muted-foreground sm:block"
                    aria-hidden
                  />
                )}
                <div className="w-full min-w-0 flex-1 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{step.label}</p>
                  <Card className="overflow-hidden p-0">
                    {screenshotUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={screenshotUrl}
                          alt={step.label}
                          width={1280}
                          height={720}
                          loading="lazy"
                          className="aspect-video w-full bg-muted object-cover object-top"
                        />
                      </>
                    ) : (
                      <div className="flex aspect-video w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                        No capture
                      </div>
                    )}
                  </Card>
                  <p className="truncate font-mono text-3xs text-muted-foreground">
                    {displayEvidenceUrl(step.url) ?? step.url}
                  </p>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {hasSteps && flowData.status !== 'success' && (
        <p className="text-sm text-muted-foreground">{status.description}</p>
      )}
    </section>
  )
}
