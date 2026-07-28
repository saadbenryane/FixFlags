'use client'
import { useState } from 'react'
import { ThumbsFeedback } from '@/components/ui/thumbs-feedback'
import { Button } from '@/components/ui/button'
import {
  FLAG_DISMISS_REASONS,
  FLAG_FEEDBACK_COPY,
  type FlagDismissReasonId,
} from '@/lib/marketing/copy'
import { useFeedbackSubmit } from '@/lib/hooks/useFeedbackSubmit'
import { cn } from '@/lib/utils'

interface Props {
  flagId: string
  /** When true, dismiss reasons also set FlagStatus to IGNORED for the owner. */
  canDismiss?: boolean
}

export function FlagFeedback({ flagId, canDismiss = false }: Props) {
  const [showReasons, setShowReasons] = useState(false)
  const { submit } = useFeedbackSubmit()

  async function submitFeedback(
    vote: number,
    comment?: string,
    reason?: FlagDismissReasonId | null,
  ) {
    const ok = await submit(
      `/api/flags/${flagId}/feedback`,
      {
        vote,
        comment,
        reason: vote === -1 ? reason ?? undefined : undefined,
        dismiss: vote === -1 && canDismiss && Boolean(reason),
      },
      FLAG_FEEDBACK_COPY.saveFailed,
    )
    if (ok && vote === -1 && canDismiss && reason) {
      const { toast } = await import('sonner')
      toast.success(FLAG_FEEDBACK_COPY.dismissed)
    }
    return ok
  }

  return (
    <div className="space-y-2">
      <ThumbsFeedback
        onSubmit={async (v, c) => {
          if (v === -1 && canDismiss) {
            setShowReasons(true)
          }
          return submitFeedback(v, c)
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
                  void submitFeedback(-1, undefined, item.id)
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
