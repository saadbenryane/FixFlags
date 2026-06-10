'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  findingId: string
}

export function FindingFeedback({ findingId }: Props) {
  const [vote, setVote] = useState<number | null>(null)

  async function handleVote(v: number) {
    if (vote === v) return
    setVote(v)
    try {
      await fetch(`/api/findings/${findingId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote: v }),
      })
      toast.success(v === 1 ? 'Thanks for the feedback!' : 'Got it — we\'ll improve this.')
    } catch {
      toast.error('Failed to save feedback')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(1)}
        className={`h-7 w-7 p-0 ${vote === 1 ? 'text-green-600' : 'text-muted-foreground'}`}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => handleVote(-1)}
        className={`h-7 w-7 p-0 ${vote === -1 ? 'text-red-500' : 'text-muted-foreground'}`}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
