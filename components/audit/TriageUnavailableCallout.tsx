'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Callout } from '@/components/ui/callout'
import { Button } from '@/components/ui/button'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { triageUnavailableBody } from '@/lib/audit/triage-unavailable'
import { parseApiErrorResponse } from '@/lib/api/parse-error'
import { toast } from 'sonner'

interface Props {
  auditId: string
  failureCode?: string | null
  isLoggedIn: boolean
  canRetry: boolean
  signUpHref: string
}

export function TriageUnavailableCallout({
  auditId,
  failureCode = null,
  isLoggedIn,
  canRetry,
  signUpHref,
}: Props) {
  const router = useRouter()
  const [retryLoading, setRetryLoading] = useState(false)
  const body = triageUnavailableBody(failureCode, isLoggedIn)
  const showSignup = !isLoggedIn
  const showRetry = canRetry && isLoggedIn

  async function handleRetry() {
    setRetryLoading(true)
    try {
      const res = await fetch(`/api/reports/${auditId}/retry`, { method: 'POST' })
      if (!res.ok) {
        toast.error((await parseApiErrorResponse(res)).message)
        return
      }
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setRetryLoading(false)
    }
  }

  return (
    <Callout variant="warning" title={REPORT_COPY.triageUnavailable.title}>
      <div className="space-y-3">
        <p>{body}</p>
        {(showSignup || showRetry) && (
          <div className="flex flex-wrap gap-2">
            {showSignup ? (
              <Button asChild size="sm">
                <Link href={signUpHref}>{REPORT_COPY.triageUnavailable.signupCta}</Link>
              </Button>
            ) : null}
            {showRetry ? (
              <Button
                size="sm"
                variant={showSignup ? 'outline' : 'default'}
                onClick={handleRetry}
                disabled={retryLoading}
              >
                {retryLoading ? 'Retrying…' : REPORT_COPY.triageUnavailable.retryCta}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </Callout>
  )
}
