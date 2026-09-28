'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { useAuthRedirect } from '@/hooks/useAuthRedirect'

/**
 * Redirect an already signed-in visitor away from sign-in / sign-up.
 *
 * The page presentation goes through `/post-login`, the single post-auth path, so
 * an anonymous Review is still claimed and its claim cookie cleared. Jumping
 * straight to `next` skips the claim and leaves the report locked. Pass
 * `disabled` for an overlay presentation, which is not a navigation.
 */
export function useRedirectIfAuthenticated(options?: { disabled?: boolean }) {
  const router = useRouter()
  const { postLoginHref } = useAuthRedirect()

  useEffect(() => {
    if (options?.disabled) return
    void (async () => {
      try {
        const { data } = await authClient.getSession()
        if (data?.user) {
          router.push(postLoginHref)
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
  }, [router, postLoginHref, options?.disabled])
}
