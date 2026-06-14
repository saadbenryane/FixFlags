'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SharedReportBannerProps {
  hostname: string
  score: number | null
  className?: string
}

export function SharedReportBanner({ hostname, score, className }: SharedReportBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div
      className={cn(
        'sticky top-16 z-10 rounded-xl border border-brand/20 bg-brand/[0.06] p-4 sm:p-5 space-y-3 shadow-card',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-semibold">Run your own audit</p>
          <p className="text-xs text-muted-foreground text-pretty">
            {hostname}
            {score != null ? (
              <>
                {' '}
                scored <span className="font-mono tabular-nums font-medium text-foreground">{score}/100</span>
              </>
            ) : null}
            . Paste your URL for a full report with fix prompts.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          aria-label="Dismiss"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <AuditInput />
    </div>
  )
}
