'use client'

import { PromptActionRow } from '@/components/audit/PromptActionRow'
import { TerminalShell } from '@/components/ui/terminal-shell'
import { OUTPUT_LABELS } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface FixPromptBlockProps {
  prompt: string
  label?: string
  finding?: string | null
  className?: string
  rows?: number
  clamp?: boolean
  showNextStep?: boolean
  showCursorAction?: boolean
  variant?: 'terminal' | 'compact'
  /** Use concentric inner radius when nested inside a rounded-card shell */
  nested?: boolean
}

export function FixPromptBlock({
  prompt,
  label = OUTPUT_LABELS.fixPrompt,
  finding,
  className,
  rows = 4,
  clamp = true,
  showNextStep = false,
  showCursorAction = false,
  variant = 'terminal',
  nested = false,
}: FixPromptBlockProps) {
  const shellRadius = nested ? 'rounded-nested-lg' : 'rounded-card'

  if (variant === 'compact') {
    return (
      <div className={cn('space-y-2', className)}>
        {finding ? (
          <p className="text-xs leading-snug text-muted-foreground text-pretty">{finding}</p>
        ) : null}
        <div
          className={cn(
            'overflow-hidden border border-terminal-border bg-terminal shadow-card',
            shellRadius
          )}
        >
          <textarea
            readOnly
            value={prompt}
            rows={rows}
            aria-label={label}
            className={cn(
              'w-full resize-none border-0 bg-transparent px-3 py-3 font-mono text-[11px] leading-relaxed text-terminal-foreground sm:px-4',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0',
              clamp && 'max-h-[8.5rem] overflow-hidden'
            )}
          />
          <div className="flex justify-end gap-2 border-t border-terminal-border/40 px-3 py-2">
            <PromptActionRow
              prompt={prompt}
              showCursorAction={showCursorAction}
              compact
              dark
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
      <TerminalShell
        label={label}
        nested={nested}
        headerRight={
          <PromptActionRow
            prompt={prompt}
            showCursorAction={showCursorAction}
            compact
            dark
          />
        }
      >
        <textarea
          readOnly
          value={prompt}
          rows={rows}
          aria-label={label}
          className={cn(
            'w-full resize-none border-0 bg-transparent px-3 py-3 font-mono text-[11px] leading-relaxed text-terminal-foreground sm:px-4',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0',
            clamp && 'max-h-[8.5rem] overflow-hidden'
          )}
        />
      </TerminalShell>
      {showNextStep ? (
        <p className="text-xs text-muted-foreground">{OUTPUT_LABELS.nextStep}</p>
      ) : null}
    </div>
  )
}
