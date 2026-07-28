'use client'

import { useCallback } from 'react'
import { toast } from 'sonner'
import { parseApiErrorResponse } from '@/lib/api/parse-error'

export interface FeedbackBody {
  vote: number
  comment?: string
  [key: string]: unknown
}

/**
 * Single feedback POST surface. Encapsulates the request, error parsing, and
 * error toast so `ReportFeedback` and `FlagFeedback` converge on one path.
 */
export function useFeedbackSubmit() {
  const submit = useCallback(
    async (
      path: string,
      body: FeedbackBody,
      errorToast = 'Could not save feedback. Try again.',
    ): Promise<boolean> => {
      try {
        const res = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const error = await parseApiErrorResponse(res)
          toast.error(error.message || errorToast)
          return false
        }
        return true
      } catch {
        toast.error(errorToast)
        return false
      }
    },
    [],
  )

  return { submit }
}
