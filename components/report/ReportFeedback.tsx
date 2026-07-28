'use client'

import { ThumbsFeedback } from '@/components/ui/thumbs-feedback'
import { useFeedbackSubmit } from '@/lib/hooks/useFeedbackSubmit'

interface Props {
  auditId: string
}

export function ReportFeedback({ auditId }: Props) {
  const { submit } = useFeedbackSubmit()

  return (
    <div className="rounded-card border border-border bg-muted/30 px-4 py-4 sm:px-6 sm:py-5">
      <ThumbsFeedback
        onSubmit={(v, c) =>
          submit(
            `/api/reports/${auditId}/feedback`,
            {
              vote: v,
              comment: c,
              pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
            },
            'Could not save feedback. Please try again.',
          )
        }
        label="Was this report useful?"
        showLabels
      />
    </div>
  )
}
