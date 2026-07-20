'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics/events'

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
}: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    trackEvent('fix_prompt_copied', { kind, audit_id: auditId, tool })
    setCopied(true)
    toast.success('Prompt copied')
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
        className={cn('h-7 w-7 text-muted-foreground hover:text-foreground', className)}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    )
  }

  return (
    <Button
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
