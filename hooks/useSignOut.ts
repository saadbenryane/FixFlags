'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { signOutClient } from '@/lib/auth/client-sign-out'
import { AUTH } from '@/lib/marketing/copy/auth'

export function useSignOut() {
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const signOut = useCallback(async function signOut(): Promise<void> {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    toast.dismiss('sign-out')
    try {
      await signOutClient()
    } catch {
      toast.error(AUTH.signOut.error, {
        id: 'sign-out',
        action: { label: AUTH.signOut.retry, onClick: () => { void signOut() } },
      })
    } finally {
      pending.current = false
      setBusy(false)
    }
  }, [])
  return { busy, signOut }
}
