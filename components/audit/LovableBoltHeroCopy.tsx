'use client'

import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { EditorMark } from '@/components/brand/EditorMarks'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportAccessState, ReportSurface } from '@/lib/analytics/events'
import type { PromptToolKey } from '@/components/audit/PromptToolSelector'

interface Props {
  tool: Extract<PromptToolKey, 'lovable' | 'bolt'>
  prompt: string
  auditId?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  itemPosition?: number
  copyNextStep?: string
}

const LABELS = {
  lovable: 'Copy for Lovable',
  bolt: 'Copy for Bolt',
} as const

export function LovableBoltHeroCopy({
  tool,
  prompt,
  auditId,
  surface,
  accessState,
  itemPosition,
  copyNextStep,
}: Props) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-inner)] border border-brand/25 bg-brand/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <EditorMark name={tool === 'lovable' ? 'Lovable' : 'Bolt'} className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-medium">{REPORT_COPY.lovableBolt.heroTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground text-pretty">
            {REPORT_COPY.lovableBolt.heroBody}
          </p>
        </div>
      </div>
      <PromptCopyButton
        prompt={prompt}
        label={LABELS[tool]}
        kind="flag"
        tool={tool}
        auditId={auditId}
        surface={surface}
        accessState={accessState}
        itemPosition={itemPosition}
        nextStep={copyNextStep}
        className="min-h-11 shrink-0"
      />
    </div>
  )
}
