'use client'

import { useEffect, useRef, useState } from 'react'
import { useFixedBottomNotice } from './useFixedBottomNotice'

export function OfflineNotice() {
  const [offline, setOffline] = useState(false)
  const notice = useRef<HTMLDivElement>(null)
  useFixedBottomNotice(notice, offline, 0)

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
      ref={notice}
      data-fixed-bottom-notice="offline"
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[var(--bottom-notice-offset,0px)] z-navbar bg-foreground px-4 py-3 text-center text-sm text-background"
    >
      You are offline. Existing pages remain visible, but actions will retry after reconnection.
    </div>
  )
}
