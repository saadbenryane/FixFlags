'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSearchParams } from 'next/navigation'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useMe } from '@/hooks/useMe'
import { trackEvent } from '@/lib/analytics/events'
import { AUTH } from '@/lib/marketing/copy'
import { useReportAuthContext } from '@/hooks/useReportAuthContext'
import { PasskeyEnrollPrompt, shouldShowPasskeyEnroll } from '@/components/auth/PasskeyEnrollPrompt'
import { runPostLoginClaimFlow } from '@/hooks/post-login-claim-flow'

function PostLoginRedirect() {
  const { navigateAfterAuth, next, plan, from } = useAuthRedirect()
  const { user, isLoading, claimedCount, error, claimAnonymous } = useMe({ load: false })
  const { hostname, reportHref, isReportContext } = useReportAuthContext(next)
  const searchParams = useSearchParams()
  const isNewOauthUser = searchParams.get('signup') === '1'
  const trackedRef = useRef(false)
  const [showPasskeyEnroll, setShowPasskeyEnroll] = useState(false)
  const claimStarted = useRef(false)

  useEffect(() => {
    if (claimStarted.current) return
    claimStarted.current = true
    void runPostLoginClaimFlow({
      claim: () => claimAnonymous({ showToast: true }),
      shouldEnroll: shouldShowPasskeyEnroll,
      showEnrollment: () => setShowPasskeyEnroll(true),
      beforeNavigate: () => {
        if (isNewOauthUser && user && !trackedRef.current) {
          trackedRef.current = true
          trackEvent('signed_up', {
            method: 'oauth',
            plan: plan ?? undefined,
            email: user.email,
            user_id: user.id,
            from: from ?? undefined,
          })
        }
      },
      navigate: navigateAfterAuth,
    })
  }, [claimAnonymous, from, isNewOauthUser, navigateAfterAuth, plan, user])

  if (showPasskeyEnroll) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <PasskeyEnrollPrompt onComplete={() => {
          setShowPasskeyEnroll(false)
          if (isNewOauthUser && user && !trackedRef.current) {
            trackedRef.current = true
            trackEvent('signed_up', {
              method: 'oauth',
              plan: plan ?? undefined,
              email: user.email,
              user_id: user.id,
              from: from ?? undefined,
            })
          }
          void navigateAfterAuth()
        }} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3 text-center" role="alert">
        <p className="font-medium">{AUTH.reportContext.saveError}</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => void claimAnonymous({ showToast: true })} className="min-h-11">
            {AUTH.reportContext.retryCta}
          </Button>
          {reportHref ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={reportHref as Route}>{AUTH.reportContext.backCta}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex max-w-sm flex-col items-center gap-3 text-center" role="status" aria-live="polite">
      {isLoading ? (
        <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
      ) : (
        <CheckCircle2 className="h-8 w-8 text-success" aria-hidden />
      )}
      <div>
        <p className="font-medium text-foreground">
          {isReportContext
            ? isLoading
              ? AUTH.reportContext.saving(hostname)
              : AUTH.reportContext.unlocking
            : AUTH.postLogin.signingIn}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isReportContext && !isLoading && claimedCount !== null
            ? AUTH.reportContext.redirecting
            : AUTH.reportContext.waiting}
        </p>
      </div>
    </div>
  )
}

export default function PostLoginPage() {
  return (
    <Suspense fallback={<div className="h-20 w-56 animate-pulse rounded-card bg-muted/50" aria-label={AUTH.postLogin.preparing} />}>
      <PostLoginRedirect />
    </Suspense>
  )
}
