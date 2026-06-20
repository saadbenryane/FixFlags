'use client'

import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { FlagFeedback } from '@/components/audit/FlagFeedback'
import { ReportAiGate } from '@/components/audit/ReportAiGate'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import type { ExplorerFlag } from '@/lib/report/explorer-model'
import { cn } from '@/lib/utils'

export function FlagDetailPanel({
  flag,
  showFeedback = false,
  aiLocked = false,
  signUpHref,
}: {
  flag: ExplorerFlag
  showFeedback?: boolean
  aiLocked?: boolean
  signUpHref?: string
}) {
  return (
    <div key={flag.id} className="space-y-5 animate-soft-reveal" aria-live="polite">
      {(flag.whyItMatters || flag.evidence) && (
        <div className="space-y-4 rounded-[var(--radius-inner)] border border-border/40 bg-muted/15 p-4 sm:p-5">
          {flag.whyItMatters && (
            <section>
              <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                Why it matters
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 text-pretty">
                {flag.whyItMatters}
              </p>
            </section>
          )}

          {flag.whyItMatters && flag.evidence && (
            <div className="border-t border-border/30" aria-hidden />
          )}

          {flag.evidence && (
            <section>
              <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
                Evidence
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 text-pretty">
                {flag.evidence}
              </p>
            </section>
          )}
        </div>
      )}

      {flag.verificationRule && (
        <section className="rounded-[var(--radius-inner)] bg-muted/30 px-4 py-3 sm:px-5 sm:py-4">
          <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            How to verify
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-foreground/90 text-pretty">
            {flag.verificationRule}
          </p>
        </section>
      )}

      {flag.hasFixPrompt && (
        <ReportAiGate locked={aiLocked} signUpHref={signUpHref}>
          <FixPromptBlock
            prompt={flag.fixPrompt}
            rows={4}
            clamp={false}
            showCursorAction
            variant="compact"
            nested
          />
        </ReportAiGate>
      )}

      {showFeedback && <FlagFeedback flagId={flag.id} />}
    </div>
  )
}

export function FlagMetaPills({ flag }: { flag: ExplorerFlag }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <RubricPill rubric={flag.rubric} label={flag.rubricLabel} />
      <span
        className={cn(
          'rounded-full px-2.5 py-1 text-[11px] font-semibold',
          flag.severity === 'CRITICAL'
            ? 'bg-destructive/10 text-destructive'
            : flag.severity === 'IMPORTANT'
              ? 'bg-brand/10 text-brand'
              : 'bg-muted text-muted-foreground'
        )}
      >
        {flag.severityLabel}
      </span>
      {flag.impactTag && (
        <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[11px] text-muted-foreground">
          {flag.impactTag}
        </span>
      )}
    </div>
  )
}
