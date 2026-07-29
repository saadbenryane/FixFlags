'use client'

import { useEffect, useState } from 'react'

export function OfflineNotice() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-navbar bg-foreground px-4 py-3 text-center text-sm text-background"
    >
      You are offline. Existing pages remain visible, but actions will retry after reconnection.
    </div>
  )
}
