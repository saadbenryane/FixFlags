'use client'

import type { ReactNode } from 'react'
import { ClipboardCheck, Lightbulb, ScanSearch, Sparkles, type LucideIcon } from 'lucide-react'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { FlagFeedback } from '@/components/audit/FlagFeedback'
import { LockedContentTeaser } from '@/components/audit/LockedContentTeaser'
import { RubricPill } from '@/components/marketing/sample/RubricDimensionHeader'
import type { ExplorerFlag } from '@/lib/report/explorer-model'
import { cn } from '@/lib/utils'

function FlagDetailCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <section className="rounded-[var(--radius-inner)] border border-border/40 bg-muted/15 p-4 sm:p-5">
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
      </div>
      {children}
    </section>
  )
}

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
    <div key={flag.id} className="space-y-3 animate-soft-reveal" aria-live="polite">
      {flag.whyItMatters && (
        <FlagDetailCard title="Why it matters" icon={Lightbulb}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{flag.whyItMatters}</p>
        </FlagDetailCard>
      )}

      {flag.evidence && (
        <FlagDetailCard title="Evidence" icon={ScanSearch}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">{flag.evidence}</p>
        </FlagDetailCard>
      )}

      {flag.verificationRule && (
        <FlagDetailCard title="How to verify" icon={ClipboardCheck}>
          <p className="text-sm leading-relaxed text-foreground/90 text-pretty">
            {flag.verificationRule}
          </p>
        </FlagDetailCard>
      )}

      {flag.hasFixPrompt && (
        <FlagDetailCard title="Fix" icon={Sparkles}>
          {aiLocked ? (
            <LockedContentTeaser
              label="Fix prompt - create a free account to view"
              signUpHref={signUpHref}
            />
          ) : (
            <FixPromptBlock
              prompt={flag.fixPrompt}
              clamp={false}
              showCursorAction
              variant="compact"
              nested
            />
          )}
        </FlagDetailCard>
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
