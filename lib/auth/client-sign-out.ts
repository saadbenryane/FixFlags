'use client'

import { withClientDeadline } from '@/lib/api/client-request'
import { clearSettingsDrafts } from '@/lib/settings/drafts'

let pending: Promise<void> | null = null

/** All sign-out controls share one confirmed transition out of the current document. */
export function signOutClient(): Promise<void> {
  if (pending) return pending
  const operation = (async () => {
    const result = await withClientDeadline(async signal => {
      const { authClient } = await import('@/lib/auth-client')
      if (signal.aborted) throw new Error('Sign-out interrupted')
      return authClient.signOut({ fetchOptions: { signal } })
    })
    if (result.error || result.data?.success !== true) throw new Error('Sign-out not confirmed')
    clearSettingsDrafts()
    // A fresh document retires both account providers and authenticated caches.
    window.location.replace('/')
  })()
  const shared = operation.finally(() => {
    if (pending === shared) pending = null
  })
  pending = shared
  return shared
}
