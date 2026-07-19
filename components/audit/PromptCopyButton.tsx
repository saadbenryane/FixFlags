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
  kind?: 'flag' | 'plan' | 'export'
  auditId?: string
  tool?: string
}

export function PromptCopyButton({
  prompt,
  label = 'Copy prompt',
  className,
  compact,
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
