'use client'

import { PromptActionRow } from '@/components/audit/PromptActionRow'
import {
  PromptToolSelector,
  resolveToolPrompt,
  usePreferredTool,
  type PromptToolKey,
} from '@/components/audit/PromptToolSelector'
import { TerminalShell } from '@/components/ui/terminal-shell'
import { OUTPUT_LABELS } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import type { ReportAccessState, ReportSurface } from '@/lib/analytics/events'

interface FixPromptBlockProps {
  prompt: string
  toolPrompts?: Partial<Record<PromptToolKey, string | null | undefined>>
  label?: string
  finding?: string | null
  className?: string
  rows?: number
  clamp?: boolean
  showNextStep?: boolean
  showCursorAction?: boolean
  showToolSelector?: boolean
  defaultTool?: PromptToolKey
  variant?: 'terminal' | 'compact'
  /** Use concentric inner radius when nested inside a rounded-card shell */
  nested?: boolean
  auditId?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  itemPosition?: number
  copyNextStep?: string
}

const promptBodyClassName =
  'w-full border-0 bg-transparent px-3 py-3 font-mono text-2xs leading-relaxed text-terminal-foreground sm:px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0'

function PromptBody({
  prompt,
  label,
  rows,
  clamp,
}: {
  prompt: string
  label: string
  rows: number
  clamp: boolean
}) {
  if (!clamp) {
    return (
      <pre
        aria-label={label}
        className={cn(promptBodyClassName, 'm-0 whitespace-pre-wrap break-words')}
      >
        {prompt}
      </pre>
    )
  }

  return (
    <textarea
      readOnly
      value={prompt}
      rows={rows}
      aria-label={label}
      className={cn(promptBodyClassName, 'resize-none max-h-[8.5rem] overflow-hidden')}
    />
  )
}

export function FixPromptBlock({
  prompt,
  toolPrompts,
  label = OUTPUT_LABELS.fixPrompt,
  finding,
  className,
  rows = 4,
  clamp = true,
  showNextStep = false,
  showCursorAction = false,
  showToolSelector = false,
  defaultTool,
  variant = 'terminal',
  nested = false,
  auditId,
  surface,
  accessState,
  itemPosition,
  copyNextStep,
}: FixPromptBlockProps) {
  const [preferredTool, setPreferredTool] = usePreferredTool(defaultTool)
  const resolvedPrompt = showToolSelector
    ? resolveToolPrompt(toolPrompts, preferredTool, prompt)
    : prompt

  const shellRadius =
    nested && variant === 'compact' ? 'rounded-[var(--radius-inner)]' : nested ? 'rounded-nested-lg' : 'rounded-card'

  const toolSelector = showToolSelector && toolPrompts ? (
    <PromptToolSelector
      toolPrompts={toolPrompts}
      selectedTool={preferredTool}
      onSelect={setPreferredTool}
    />
  ) : null

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        {finding ? (
          <p className="text-xs leading-snug text-muted-foreground text-pretty">{finding}</p>
        ) : null}
        {toolSelector}
        <div
          className={cn(
            'bg-terminal shadow-card',
            shellRadius,
            clamp ? 'overflow-hidden' : 'overflow-visible'
          )}
        >
          <PromptBody prompt={resolvedPrompt} label={label} rows={rows} clamp={clamp} />
          <div className="flex justify-end gap-2 border-t border-terminal-border/60 px-3 py-2">
            <PromptActionRow
              prompt={resolvedPrompt}
              showCursorAction={showCursorAction}
              compact
              tool={showToolSelector ? preferredTool : undefined}
              auditId={auditId}
              surface={surface}
              accessState={accessState}
              itemPosition={itemPosition}
              nextStep={copyNextStep}
            />
          </div>
        </div>
        {showNextStep ? (
          <p className="text-xs text-muted-foreground">{OUTPUT_LABELS.nextStep}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {finding ? (
        <p className="text-xs leading-snug text-muted-foreground text-pretty">{finding}</p>
      ) : null}
      {toolSelector}
      <TerminalShell
        label={label}
        nested={nested}
        className={clamp ? undefined : 'overflow-visible'}
        headerRight={
          <PromptActionRow
            prompt={resolvedPrompt}
            showCursorAction={showCursorAction}
            compact
            tool={showToolSelector ? preferredTool : undefined}
            auditId={auditId}
            surface={surface}
            accessState={accessState}
            itemPosition={itemPosition}
            nextStep={copyNextStep}
          />
        }
      >
        <PromptBody prompt={resolvedPrompt} label={label} rows={rows} clamp={clamp} />
      </TerminalShell>
      {showNextStep ? (
        <p className="text-xs text-muted-foreground">{OUTPUT_LABELS.nextStep}</p>
      ) : null}
    </div>
  )
}
