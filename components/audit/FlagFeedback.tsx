'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  flagId: string
}

export function FlagFeedback({ flagId }: Props) {
  const [vote, setVote] = useState<number | null>(null)
  const [comment, setComment] = useState('')
  const [showComment, setShowComment] = useState(false)
  const [sending, setSending] = useState(false)

  async function save(v: number, c?: string) {
    setSending(true)
    try {
      await fetch(`/api/flags/${flagId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: v, comment: c }),
      })
      return true
    } catch {
      toast.error('Failed to save feedback')
      return false
    } finally {
      setSending(false)
    }
  }

  async function handleVote(v: number) {
    if (vote === v) return
    const wasNew = vote === null
    setVote(v)
    const ok = await save(v)
    if (!ok) return
    if (v === -1) {
      // Invite a quick note on what's wrong (the most useful signal for us).
      setShowComment(true)
    } else {
      setShowComment(false)
      if (wasNew) toast.success('Thanks for the feedback!')
    }
  }

  async function handleSendComment() {
    if (vote === null) return
    const ok = await save(vote, comment.trim() || undefined)
    if (ok) {
      setShowComment(false)
      toast.success("Got it, we'll improve this.")
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVote(1)}
          disabled={sending}
          className={`h-7 w-7 p-0 ${vote === 1 ? 'text-success' : 'text-muted-foreground'}`}
          aria-label="This flag is accurate"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleVote(-1)}
          disabled={sending}
          className={`h-7 w-7 p-0 ${vote === -1 ? 'text-destructive' : 'text-muted-foreground'}`}
          aria-label="This flag is wrong or unhelpful"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showComment && (
        <div className="space-y-1.5">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="What's wrong with this flag? (optional)"
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
