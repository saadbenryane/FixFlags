'use client'

import { Suspense, useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'
import { useMe } from '@/hooks/useMe'
import { trackEvent } from '@/lib/analytics/events'

function PostLoginRedirect() {
  const { navigateAfterAuth, plan, from } = useAuthRedirect()
  const { user, isLoading } = useMe({ claim: true, showClaimToast: true })
  const searchParams = useSearchParams()
  // signup=1 is only set by better-auth's newUserCallbackURL, i.e. a
  // first-time OAuth account. Email signups track on the sign-up form.
  const isNewOauthUser = searchParams.get('signup') === '1'
  const trackedRef = useRef(false)

  useEffect(() => {
    if (isLoading) return
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
  }, [isLoading, isNewOauthUser, user, plan, from, navigateAfterAuth])

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Signing you in...</p>
    </div>
  )
}

export default function PostLoginPage() {
  return (
    <Suspense>
      <PostLoginRedirect />
    </Suspense>
  )
}
