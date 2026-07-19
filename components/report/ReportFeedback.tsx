'use client'

import { ThumbsFeedback } from '@/components/ui/thumbs-feedback'

interface Props {
  auditId: string
}

export function ReportFeedback({ auditId }: Props) {
  async function submit(vote: 1 | -1, comment?: string) {
    try {
      const res = await fetch(`/api/audits/${auditId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vote,
          comment,
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      })
      if (!res.ok) throw new Error('failed')
      return true
    } catch {
      const { toast } = await import('sonner')
      toast.error('Could not save feedback. Please try again.')
      return false
    }
  }

  return (
    <div className="rounded-card border border-border bg-muted/30 px-4 py-4 sm:px-6 sm:py-5">
      <ThumbsFeedback
        onSubmit={(v, c) => submit(v as 1 | -1, c)}
        label="Was this report useful?"
        showLabels
      />
    </div>
  )
}
