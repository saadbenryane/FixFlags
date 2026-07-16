'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface Props {
  auditId: string
}

type Vote = 1 | -1

export function ReportFeedback({ auditId }: Props) {
  const [vote, setVote] = useState<Vote | null>(null)
  const [comment, setComment] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(nextVote: Vote, nextComment?: string) {
    setSending(true)
    try {
      const res = await fetch(`/api/audits/${auditId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vote: nextVote,
          comment: nextComment,
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      })
      if (!res.ok) throw new Error('failed')
      return true
    } catch {
      toast.error('Could not save feedback. Please try again.')
      return false
    } finally {
      setSending(false)
    }
  }

  async function handleVote(next: Vote) {
    if (vote === next) return
    setVote(next)
    // Record the vote immediately so it counts even without a written comment.
    await submit(next)
  }

  async function handleSendComment() {
    if (!vote) return
    const ok = await submit(vote, comment.trim() || undefined)
    if (ok) {
      setDone(true)
      toast.success('Thanks! This helps us improve.')
    }
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-card border border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
        <Check className="h-4 w-4 text-success" />
        Thanks for the feedback.
      </div>
    )
  }

  return (
    <div className="rounded-card border border-border bg-muted/30 px-4 py-4 sm:px-6 sm:py-5">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm font-medium">Was this report useful?</p>
        <div className="flex items-center gap-2">
          <Button
            variant={vote === 1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => void handleVote(1)}
            disabled={sending}
            className={cn('gap-1.5', vote === 1 && 'text-success-foreground')}
            aria-pressed={vote === 1}
            aria-label="This report was useful"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
            Yes
          </Button>
          <Button
            variant={vote === -1 ? 'default' : 'outline'}
            size="sm"
            onClick={() => void handleVote(-1)}
            disabled={sending}
            className="gap-1.5"
            aria-pressed={vote === -1}
            aria-label="This report was not useful"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
            No
          </Button>
        </div>
      </div>

      {vote !== null && (
        <div className="mt-4 space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={
              vote === 1
                ? 'What was most helpful? (optional)'
                : 'What was off, missing, or wrong? (optional)'
            }
            className="resize-none text-sm"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setDone(true)} disabled={sending}>
              Skip
            </Button>
            <Button size="sm" onClick={() => void handleSendComment()} disabled={sending}>
              Send feedback
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
