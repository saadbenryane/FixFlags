'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
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
    <Callout
      variant="info"
      title="Run your own audit"
      className={cn(
        'sticky top-[var(--header-offset)] z-10 bg-brand-muted/80 backdrop-blur-sm',
        className
      )}
      icon={null}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs text-muted-foreground text-pretty">
            {hostname}
            {score != null ? (
              <>
                {' '}
                scored{' '}
                <span className="font-mono tabular-nums font-medium text-foreground">
                  {score}/100
                </span>
              </>
            ) : null}
            . Paste your URL for a free deterministic check. Sign up to unlock AI fix prompts.
          </p>
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
        <AuditInput source="report" />
      </div>
    </Callout>
  )
}
