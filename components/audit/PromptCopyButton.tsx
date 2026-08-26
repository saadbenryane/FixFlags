'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ButtonProps } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { isUsableFixPrompt } from '@/lib/audit/priority-flags'
import { LOCKED_CONTENT_TEASER, REPORT_COPY } from '@/lib/marketing/copy'
import {
  trackEvent,
  type ReportAccessState,
  type ReportSurface,
} from '@/lib/analytics/events'

interface Props {
  prompt: string
  label?: string
  className?: string
  compact?: boolean
  /** Ghost icon-only button (ChatGPT/Claude code-block style). */
  iconOnly?: boolean
  kind?: 'flag' | 'plan' | 'export'
  auditId?: string
  flagId?: string
  tool?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  itemPosition?: number
  nextStep?: string
  variant?: ButtonProps['variant']
  /** Show the button and run this instead of copying. Used for anonymous claim gates. */
  onLockedAction?: () => void
}

export function PromptCopyButton({
  prompt,
  label = REPORT_COPY.explorer.copyPrompt,
  className,
  compact,
  iconOnly = false,
  kind = 'flag',
  auditId,
  flagId,
  tool,
  surface,
  accessState,
  itemPosition,
  nextStep,
  variant = 'outline',
  onLockedAction,
}: Props) {
  const [copied, setCopied] = useState(false)
  const safePrompt = isUsableFixPrompt(prompt) ? prompt.trim() : null

  async function handleCopy() {
    if (onLockedAction) {
      onLockedAction()
      return
    }
    if (!safePrompt) {
      toast.error(LOCKED_CONTENT_TEASER.fixPromptLabel)
      return
    }
    await navigator.clipboard.writeText(safePrompt)
    if (flagId && accessState === 'owner') {
      const response = await fetch(`/api/flags/${flagId}/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ builder: tool || 'web', action: 'HANDOFF_COPIED' }),
      })
      if (!response.ok) {
        toast.error(REPORT_COPY.explorer.promptCopiedRecordFailed)
      }
    }
    trackEvent('fix_prompt_copied', {
      kind,
      audit_id: auditId,
      tool,
      surface,
      access_state: accessState,
      item_position: itemPosition,
    })
    if (kind === 'plan') {
      trackEvent('polish_pass_copied', {
        audit_id: auditId,
        surface,
        access_state: accessState,
      })
    }
    setCopied(true)
    toast.success(
      REPORT_COPY.explorer.promptCopied,
      nextStep ? { description: nextStep } : undefined,
    )
    setTimeout(() => setCopied(false), 2000)
  }

  if (!safePrompt && !onLockedAction) {
    return null
  }

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label={copied ? REPORT_COPY.explorer.copied : label}
        className={cn('text-muted-foreground hover:text-foreground', className)}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={compact ? 'xs' : 'sm'}
      onClick={handleCopy}
      className={cn(compact ? 'gap-1.5 [&_svg]:size-3.5' : '[&_svg]:size-4', className)}
    >
      {copied ? (
        <><Check className="h-3 w-3" /> {REPORT_COPY.explorer.copied}</>
      ) : (
        <><Copy className="h-3 w-3" /> {label}</>
      )}
    </Button>
  )
}
