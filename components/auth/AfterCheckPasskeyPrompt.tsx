'use client'

import { useEffect, useState } from 'react'
import { PasskeyEnrollPrompt, shouldShowPasskeyEnroll } from './PasskeyEnrollPrompt'

/** Optional account setup follows the first finished check, never the sign-in handoff. */
export function AfterCheckPasskeyPrompt({ ownerId }: { ownerId: string }) {
  const [visible, setVisible] = useState(false)
  const key = `fixflags:passkey-suggestion:${ownerId}`
  useEffect(() => {
    const controller = new AbortController()
    try { if (sessionStorage.getItem(key)) return } catch { /* The prompt still works without storage. */ }
    void shouldShowPasskeyEnroll(controller.signal).then(show => { if (!controller.signal.aborted) setVisible(show) })
    return () => controller.abort()
  }, [key])
  if (!visible) return null
  return <PasskeyEnrollPrompt ownerId={ownerId} onComplete={() => {
    try { sessionStorage.setItem(key, 'dismissed') } catch { /* Dismissal remains effective in this view. */ }
    setVisible(false)
  }} />
}
