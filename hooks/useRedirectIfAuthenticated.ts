'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

/** Redirect authenticated users away from sign-in / sign-up. */
export function useRedirectIfAuthenticated(options?: { disabled?: boolean }) {
  const { navigateAfterAuth } = useAuthRedirect()

  useEffect(() => {
    if (options?.disabled) return
    void (async () => {
      try {
        const { data } = await authClient.getSession()
        if (data?.user) {
          await navigateAfterAuth()
        }
      } catch (error) {
        // This background check is routinely cancelled when the visitor leaves
        // the auth page. Keep the form usable and surface genuine live-page
        // failures to diagnostics without creating an unhandled rejection.
        if (document.visibilityState === 'visible') {
          console.warn('Could not check the current session', error)
        }
      }
    })()
  }, [navigateAfterAuth, options?.disabled])
}
