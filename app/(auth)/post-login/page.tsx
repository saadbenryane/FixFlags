'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useSearchParams } from 'next/navigation'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useMe } from '@/hooks/useMe'
import { trackEvent } from '@/lib/analytics/events'
import { AUTH } from '@/lib/marketing/copy-barrel'
import { useSiteAuthContext } from '@/hooks/useSiteAuthContext'
import { PasskeyEnrollPrompt, shouldShowPasskeyEnroll } from '@/components/auth/PasskeyEnrollPrompt'
import { runPostLoginClaimFlow, type ClaimFlowAccount } from '@/hooks/post-login-claim-flow'
import { useSiteAction } from '@/hooks/useSiteAction'

function PostLoginRedirect() {
  const { navigateAfterAuth, next, plan, from } = useAuthRedirect()
  const { user, isLoading, claimedCount, error, claimAnonymous } = useMe({ load: false })
  const { hostname, siteHref, isSiteContext } = useSiteAuthContext(next)
  const searchParams = useSearchParams()
  const isNewOauthUser = searchParams.get('signup') === '1'
  const trackedRef = useRef(false)
  const [enrollment, setEnrollment] = useState<{ account?: ClaimFlowAccount | null } | null>(null)
  const claimStarted = useRef(false)
  const { busy, error: flowError, submit } = useSiteAction()

  const trackSignup = useCallback((account: ClaimFlowAccount | null | undefined) => {
    if (!isNewOauthUser || !account || trackedRef.current) return
    trackedRef.current = true
    try {
      trackEvent('signed_up', { method: 'oauth', plan: plan ?? undefined, email: account.email, user_id: account.id, from: from ?? undefined })
    } catch { /* Optional analytics cannot interrupt the sign-in handoff. */ }
  }, [isNewOauthUser, plan, from])

  const startClaimFlow = useCallback(async () => {
    await submit(signal => runPostLoginClaimFlow({
      signal,
      claim: () => claimAnonymous({ showToast: true }),
      shouldEnroll: shouldShowPasskeyEnroll,
      skipEnrollment: Boolean(next),
      showEnrollment: claimed => setEnrollment({ account: claimed.user }),
      beforeNavigate: claimed => trackSignup(claimed.user === undefined ? user : claimed.user),
      navigate: navigateAfterAuth,
    }), () => null)
  }, [claimAnonymous, navigateAfterAuth, next, submit, trackSignup, user])

  useEffect(() => {
    let active = true
    // Effect replay retires an unstarted handoff before it can claim or navigate.
    void Promise.resolve().then(() => {
      if (!active || claimStarted.current) return
      claimStarted.current = true
      void startClaimFlow()
    })
    return () => { active = false }
  }, [startClaimFlow])

  if (enrollment) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <PasskeyEnrollPrompt ownerId={user?.id ?? null} onComplete={() => {
          setEnrollment(null)
          trackSignup(enrollment.account === undefined ? user : enrollment.account)
          void navigateAfterAuth()
        }} />
      </div>
    )
  }

  if (error || flowError) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-3 text-center" role="alert">
        <p className="font-medium">{AUTH.reportContext.saveError}</p>
        <p className="text-sm text-muted-foreground">{error ?? AUTH.me.claimError}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => void startClaimFlow()}
            loading={busy}
            className="min-h-11"
          >
            {AUTH.reportContext.retryCta}
          </Button>
          {siteHref ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={siteHref as Route}>{AUTH.reportContext.backCta}</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void navigateAfterAuth()}
              disabled={busy}
            >
              {AUTH.postLogin.continueCta}
            </Button>
          )}
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
          {isSiteContext
            ? isLoading
              ? AUTH.reportContext.saving(hostname)
              : AUTH.reportContext.unlocking
            : AUTH.postLogin.signingIn}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSiteContext && !isLoading && claimedCount !== null
            ? AUTH.reportContext.redirecting
            : AUTH.reportContext.waiting}
        </p>
      </div>
    </div>
  )
}

function PostLoginContext() {
  const params = useSearchParams()
  const context = JSON.stringify([params.get('next'), params.get('plan'), params.get('from'), params.get('signup') === '1'])
  return <PostLoginRedirect key={context} />
}

export default function PostLoginPage() {
  return (
    <Suspense fallback={<div className="h-20 w-56 animate-pulse rounded-card bg-muted/50" aria-label={AUTH.postLogin.preparing} />}>
      <PostLoginContext />
    </Suspense>
  )
}
