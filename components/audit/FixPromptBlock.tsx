'use client'

import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { OUTPUT_LABELS } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface FixPromptBlockProps {
  prompt: string
  label?: string
  finding?: string | null
  className?: string
  rows?: number
  clamp?: boolean
}

export function FixPromptBlock({
  prompt,
  label = OUTPUT_LABELS.fixPrompt,
  finding,
  className,
  rows = 4,
  clamp = true,
}: FixPromptBlockProps) {
  return (
    <div className={cn('space-y-2', className)}>
      {finding ? (
        <p className="text-xs leading-snug text-muted-foreground text-pretty">{finding}</p>
      ) : null}
      <div className="overflow-hidden rounded-md border border-border/60 bg-zinc-950 text-zinc-100 shadow-inner dark:border-zinc-700/80">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-400/80" aria-hidden />
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400/80" aria-hidden />
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400/80" aria-hidden />
            <span className="truncate font-mono text-[10px] uppercase tracking-label text-zinc-400">
              {label}
            </span>
          </div>
          <PromptCopyButton
            prompt={prompt}
            compact
            className="h-7 border-white/15 bg-white/5 text-zinc-100 hover:bg-white/10 hover:text-white"
          />
        </div>
        <textarea
          readOnly
          value={prompt}
          rows={rows}
          aria-label={label}
          className={cn(
            'w-full resize-none border-0 bg-transparent px-3 py-3 font-mono text-[11px] leading-relaxed text-zinc-100/95',
            'focus-visible:outline-none',
            clamp && 'max-h-[8.5rem] overflow-hidden'
          )}
        />
      </div>
    </div>
  )
}
