'use client'

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { LockedContentTeaser } from '@/components/audit/LockedContentTeaser'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { Skeleton } from '@/components/ui/skeleton'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportAccessState, ReportSurface } from '@/lib/analytics/events'
import { cn } from '@/lib/utils'

interface ReportFinishPlanProps {
  flagCount: number
  prompt: string | null
  loading?: boolean
  locked?: boolean
  generating?: boolean
  signUpHref?: string
  auditId?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  className?: string
}

export function ReportFinishPlan({
  flagCount,
  prompt,
  loading = false,
  locked = false,
  generating = false,
  signUpHref,
  auditId,
  surface = 'focused',
  accessState,
  className,
}: ReportFinishPlanProps) {
  const [previewOpen, setPreviewOpen] = useState(false)
  const copy = REPORT_COPY.finishPlan
  const hasPrompt = Boolean(prompt?.trim())
  const showLocked = locked && !hasPrompt
  const showGenerating = generating && !hasPrompt && !loading

  if (!loading && flagCount === 0 && !hasPrompt) {
    return null
  }

  return (
    <section
      id="report-finish-plan"
      aria-label={copy.title}
      className={cn(
        'scroll-mt-[var(--report-chrome-offset)] overflow-hidden rounded-card bg-card/80 shadow-card glass-surface',
        className
      )}
    >
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="section-label">{copy.title}</p>
            {loading ? (
              <p className="text-sm text-muted-foreground text-pretty">{copy.loadingBody}</p>
            ) : (
              <p className="text-sm text-muted-foreground text-pretty">
                {copy.readyBody(flagCount)}
              </p>
            )}
          </div>
          {!loading && hasPrompt ? (
            <PromptCopyButton
              prompt={prompt!}
              label={copy.copyCta}
              kind="plan"
              auditId={auditId}
              surface={surface}
              accessState={accessState}
              compact
            />
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-10 w-full rounded-[var(--radius-control)]" />
            <Skeleton className="h-24 w-full rounded-[var(--radius-inner)]" />
          </div>
        ) : showGenerating ? (
          <div className="flex items-center gap-2 rounded-[var(--radius-inner)] bg-muted/25 px-4 py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 motion-safe:animate-spin" aria-hidden />
            <span>{copy.generating}</span>
          </div>
        ) : showLocked ? (
          <LockedContentTeaser
            label={copy.demonstratedNote}
            signUpHref={signUpHref}
          />
        ) : hasPrompt ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setPreviewOpen((open) => !open)}
              className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              aria-expanded={previewOpen}
            >
              {copy.previewToggle}
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform motion-safe:duration-200',
                  previewOpen && 'rotate-180'
                )}
                aria-hidden
              />
            </button>
            {previewOpen ? (
              <FixPromptBlock
                prompt={prompt!}
                label={copy.copyLabel}
                render="markdown"
                variant="compact"
                nested
                clamp={false}
                rows={8}
                auditId={auditId}
                surface={surface}
                accessState={accessState}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}
