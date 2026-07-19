'use client'
import { ThumbsFeedback } from '@/components/ui/thumbs-feedback'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { FLAG_FEEDBACK_COPY } from '@/lib/marketing/copy'

interface Props {
  flagId: string
}

export function FlagFeedback({ flagId }: Props) {
  async function submit(vote: number, comment?: string) {
    try {
      const res = await fetch(`/api/flags/${flagId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vote, comment }),
      })
      if (!res.ok) {
        const error = await parseApiErrorResponse(res)
        const { toast } = await import('sonner')
        toast.error(error.message || FLAG_FEEDBACK_COPY.saveFailed)
        return false
      }
      return true
    } catch {
      const { toast } = await import('sonner')
      toast.error(FLAG_FEEDBACK_COPY.saveFailed)
      return false
    }
  }

  return <ThumbsFeedback onSubmit={(v, c) => submit(v, c)} />
}
