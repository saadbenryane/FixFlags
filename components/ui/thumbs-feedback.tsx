'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Vote = 1 | -1

interface ThumbsFeedbackProps {
  onSubmit: (vote: Vote, comment?: string) => Promise<boolean>
  label?: string
  showLabels?: boolean
  className?: string
}

export function ThumbsFeedback({
  onSubmit,
  label,
  showLabels = false,
  className,
}: ThumbsFeedbackProps) {
  const [vote, setVote] = useState<Vote | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)

  async function handleVote(next: Vote) {
    if (vote === next) return
    const previous = vote
    const wasNew = vote === null
    setVote(next)
    setSending(true)
    const ok = await onSubmit(next)
    setSending(false)
    if (!ok) {
      setVote(previous)
      return
    }
    if (next === -1) {
      setShowComment(true)
    } else {
      setShowComment(false)
      if (wasNew) toast.success('Thanks for the feedback.')
    }
  }

  async function handleSendComment() {
    if (vote === null) return
    setSending(true)
    const ok = await onSubmit(vote, comment.trim() || undefined)
    setSending(false)
    if (ok) {
      setDone(true)
      toast.success('Thanks for the feedback.')
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
    <div className={cn('space-y-2', className)}>
      {label && (
        <p className="text-sm font-medium">{label}</p>
      )}
      <div className={cn(label ? '' : 'flex items-center', 'gap-1')}>
        <Button
          variant={showLabels ? (vote === 1 ? 'default' : 'outline') : 'ghost'}
          size="sm"
          onClick={() => void handleVote(1)}
          disabled={sending}
          className={cn(
            showLabels ? 'gap-1.5' : 'h-7 w-7 p-0',
            vote === 1 && (showLabels ? 'text-success-foreground' : 'text-success')
          )}
          aria-pressed={vote === 1}
          aria-label="This is accurate"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          {showLabels && 'Yes'}
        </Button>
        <Button
          variant={showLabels ? (vote === -1 ? 'default' : 'outline') : 'ghost'}
          size="sm"
          onClick={() => void handleVote(-1)}
          disabled={sending}
          className={cn(
            showLabels ? 'gap-1.5' : 'h-7 w-7 p-0',
            vote === -1 && (showLabels ? '' : 'text-destructive')
          )}
          aria-pressed={vote === -1}
          aria-label="This is wrong or unhelpful"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          {showLabels && 'No'}
        </Button>
      </div>

      {showComment && (
        <div className="space-y-1.5">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What was off, missing, or wrong? (optional)"
            className="resize-none text-xs"
          />
          <div className="flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowComment(false)} disabled={sending}>
              Skip
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={() => void handleSendComment()} disabled={sending}>
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
