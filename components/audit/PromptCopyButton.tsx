'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  tool?: string
  surface?: ReportSurface
  accessState?: ReportAccessState
  itemPosition?: number
  nextStep?: string
}

export function PromptCopyButton({
  prompt,
  label = 'Copy prompt',
  className,
  compact,
  iconOnly = false,
  kind = 'flag',
  auditId,
  tool,
  surface,
  accessState,
  itemPosition,
  nextStep,
}: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    trackEvent('fix_prompt_copied', {
      kind,
      audit_id: auditId,
      tool,
      surface,
      access_state: accessState,
      item_position: itemPosition,
    })
    setCopied(true)
    toast.success('Prompt copied', nextStep ? { description: nextStep } : undefined)
    setTimeout(() => setCopied(false), 2000)
  }

  if (iconOnly) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : label}
        className={cn('h-11 w-11 text-muted-foreground hover:text-foreground', className)}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? 'xs' : 'sm'}
      onClick={handleCopy}
      className={cn(compact ? 'gap-1.5 [&_svg]:size-3.5' : '[&_svg]:size-4', className)}
    >
      {copied ? (
        <><Check className="h-3 w-3" /> Copied!</>
      ) : (
        <><Copy className="h-3 w-3" /> {label}</>
      )}
    </Button>
  )
}
