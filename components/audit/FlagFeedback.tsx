'use client'
import { useState } from 'react'
import { ThumbsFeedback } from '@/components/ui/thumbs-feedback'
import { Button } from '@/components/ui/button'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import {
  FLAG_DISMISS_REASONS,
  FLAG_FEEDBACK_COPY,
  type FlagDismissReasonId,
} from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface Props {
  flagId: string
  /** When true, dismiss reasons also set FlagStatus to IGNORED for the owner. */
  canDismiss?: boolean
}

export function FlagFeedback({ flagId, canDismiss = false }: Props) {
  const [showReasons, setShowReasons] = useState(false)

  async function submit(
    vote: number,
    comment?: string,
    reason?: FlagDismissReasonId | null,
  ) {
    try {
      const res = await fetch(`/api/flags/${flagId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vote,
          comment,
          reason: vote === -1 ? reason ?? undefined : undefined,
          dismiss: vote === -1 && canDismiss && Boolean(reason),
        }),
      })
      if (!res.ok) {
        const error = await parseApiErrorResponse(res)
        const { toast } = await import('sonner')
        toast.error(error.message || FLAG_FEEDBACK_COPY.saveFailed)
        return false
      }
      if (vote === -1 && canDismiss && reason) {
        const { toast } = await import('sonner')
        toast.success(FLAG_FEEDBACK_COPY.dismissed)
      }
      return true
    } catch {
      const { toast } = await import('sonner')
      toast.error(FLAG_FEEDBACK_COPY.saveFailed)
      return false
    }
  }

  return (
    <div className="space-y-2">
      <ThumbsFeedback
        onSubmit={async (v, c) => {
          if (v === -1 && canDismiss) {
            setShowReasons(true)
          }
          return submit(v, c)
        }}
      />
      {canDismiss && showReasons && (
        <div className="space-y-2 rounded-card border border-border/50 bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {FLAG_FEEDBACK_COPY.dismissPrompt}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {FLAG_DISMISS_REASONS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant="outline"
                className={cn('h-7 rounded-full text-xs')}
                onClick={() => {
                  void submit(-1, undefined, item.id)
                }}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
