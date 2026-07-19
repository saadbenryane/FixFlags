'use client'

import { useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

/** Redirect authenticated users away from sign-in / sign-up. */
export function useRedirectIfAuthenticated() {
  const { navigateAfterAuth } = useAuthRedirect()

  useEffect(() => {
    void (async () => {
      const { data } = await authClient.getSession()
      if (data?.user) {
        await navigateAfterAuth()
      }
    })()
  }, [navigateAfterAuth])
}
