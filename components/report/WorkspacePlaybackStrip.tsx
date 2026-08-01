'use client'

import { cn } from '@/lib/utils'

interface PlaybackStep {
  id: string
  label: string
}

interface WorkspacePlaybackStripProps {
  steps: PlaybackStep[]
  activeStepId?: string | null
  onSelectStep?: (id: string) => void
  className?: string
}

export function WorkspacePlaybackStrip({
  steps,
  activeStepId,
  onSelectStep,
  className,
}: WorkspacePlaybackStripProps) {
  if (steps.length === 0) return null

  return (
    <ol
      className={cn(
        'flex items-center gap-2 overflow-x-auto rounded-card border border-border bg-muted/30 px-3 py-2',
        className
      )}
      aria-label="Path playback"
    >
      {steps.map((step, index) => (
        <li key={step.id} className="shrink-0 list-none">
          <button
            type="button"
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              activeStepId === step.id
                ? 'bg-brand text-brand-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onSelectStep?.(step.id)}
          >
            {index + 1}. {step.label}
          </button>
        </li>
      ))}
    </ol>
  )
}
