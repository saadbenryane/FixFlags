'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  prompt: string
  label?: string
  className?: string
  compact?: boolean
}

export function PromptCopyButton({ prompt, label = 'Copy prompt', className, compact }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt)
    setCopied(true)
    toast.success('Prompt copied')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="outline"
      size={compact ? 'xs' : 'sm'}
      onClick={handleCopy}
      className={cn(compact && 'gap-1.5', className)}
    >
      {copied ? (
        <><Check className="h-3 w-3" /> Copied!</>
      ) : (
        <><Copy className="h-3 w-3" /> {label}</>
      )}
    </Button>
  )
}
