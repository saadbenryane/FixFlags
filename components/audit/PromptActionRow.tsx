'use client'

import { Loader2, PlugZap } from 'lucide-react'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { ReadyToVerifyButton } from '@/components/audit/ReadyToVerifyButton'
import { Button } from '@/components/ui/button'
import { useConnectBuilderMcp } from '@/lib/hooks/useConnectBuilderMcp'
import { cn } from '@/lib/utils'
import type { ReportAccessState, ReportSurface } from '@/lib/analytics/events'

interface PromptActionRowProps {
  prompt: string
  copyLabel?: string
  showCursorAction?: boolean
  className?: string
  compact?: boolean
  tool?: string
  auditId?: string
  flagId?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  itemPosition?: number
  nextStep?: string
}

export function PromptActionRow({
  prompt,
  copyLabel,
  showCursorAction = false,
  className,
  compact = false,
  tool,
  auditId,
  flagId,
  surface,
  accessState,
  itemPosition,
  nextStep,
}: PromptActionRowProps) {
  const { installing, connect, actionBuilder } = useConnectBuilderMcp(tool)

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {showCursorAction && (
        <Button
          variant="outline"
          size="xs"
          className="gap-1.5"
          disabled={installing}
          onClick={connect}
          aria-label={`Connect ${actionBuilder.label} to FixFlags`}
        >
          {installing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <PlugZap className="h-3.5 w-3.5" aria-hidden />
          )}
          {`Connect ${actionBuilder.label}`}
        </Button>
      )}
      <PromptCopyButton
        prompt={prompt}
        label={copyLabel}
        compact={compact}
        tool={tool}
        auditId={auditId}
        flagId={flagId}
        surface={surface}
        accessState={accessState}
        itemPosition={itemPosition}
        nextStep={nextStep}
      />
      {flagId && accessState === 'owner' ? (
        <ReadyToVerifyButton flagId={flagId} builder={tool || 'web'} compact={compact} />
      ) : null}
    </div>
  )
}
