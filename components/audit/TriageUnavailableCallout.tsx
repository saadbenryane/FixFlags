'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Route } from 'next'
import { Callout } from '@/components/ui/callout'
import { Button } from '@/components/ui/button'
import { REPORT_COPY, SITE_ACTION_COPY } from '@/lib/marketing/copy-barrel'
import { triageUnavailableBody } from '@/lib/audit/triage-unavailable'
import { createSiteActionController, executeSiteAction } from '@/lib/sites/client-actions'
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
  const retryAction = useRef(createSiteActionController()).current
  const body = triageUnavailableBody(failureCode, isLoggedIn)
  const showSignup = !isLoggedIn
  const showRetry = canRetry && isLoggedIn

  async function handleRetry() {
    if (retryAction.pending) return
    setRetryLoading(true)
    const completed = await retryAction.submit(
      () => executeSiteAction(`/api/reports/${auditId}/retry`, { method: 'POST' }, 'retry'),
      undefined,
      result => router.push(`/report/${encodeURIComponent(result.auditId)}` as Route),
    )
    if (completed.kind === 'refused') toast.error(completed.error.message)
    else if (completed.kind === 'saved_refresh_pending') toast.error(SITE_ACTION_COPY.refreshPending)
    setRetryLoading(false)
  }

  return (
    <Callout variant="warning" title={REPORT_COPY.triageUnavailable.title}>
      <div className="space-y-3">
        <p>{body}</p>
        {(showSignup || showRetry) && (
          <div className="flex flex-wrap gap-2">
            {showSignup ? (
              <Button asChild size="sm">
                <Link href={signUpHref as Route}>{REPORT_COPY.triageUnavailable.signupCta}</Link>
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
