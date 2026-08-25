'use client'

import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SITE_URL } from '@/lib/marketing/copy'
import { useCopyToClipboard } from '@/lib/hooks/useCopyToClipboard'

interface Props {
  auditId: string
  label?: string
}

export function ShareCompareButton({ auditId, label = 'Copy comparison link' }: Props) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={() => copy(`${SITE_URL}/compare/${auditId}`, {
        kind: 'link',
        auditId,
        successMessage: 'Comparison link copied',
      })}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}
