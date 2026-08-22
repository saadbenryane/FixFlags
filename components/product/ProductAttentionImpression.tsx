'use client'

import { useEffect, useRef, type ReactNode } from 'react'

const INITIAL_RETRY_DELAY_MS = 1_000
const MAX_RETRY_DELAY_MS = 30_000

export function ProductAttentionImpression({
  onVisible,
  children,
}: {
  onVisible: () => Promise<void>
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const recorded = useRef(false)

  useEffect(() => {
    const target = ref.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    let disposed = false
    let visible = false
    let inFlight = false
    let retryDelay = INITIAL_RETRY_DELAY_MS
    let retryTimer: ReturnType<typeof setTimeout> | null = null

    const clearRetry = () => {
      if (retryTimer) clearTimeout(retryTimer)
      retryTimer = null
    }

    const record = async () => {
      if (disposed || recorded.current || inFlight || !visible) return
      inFlight = true
      try {
        await onVisible()
        recorded.current = true
        clearRetry()
        observer.disconnect()
      } catch {
        if (!disposed && visible) {
          clearRetry()
          retryTimer = setTimeout(() => {
            retryTimer = null
            void record()
          }, retryDelay)
          retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS)
        }
      } finally {
        inFlight = false
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        visible = entries.some((entry) => entry.isIntersecting)
        if (!visible) {
          clearRetry()
          retryDelay = INITIAL_RETRY_DELAY_MS
          return
        }
        void record()
      },
      { threshold: 0.25 },
    )
    observer.observe(target)
    return () => {
      disposed = true
      clearRetry()
      observer.disconnect()
    }
  }, [onVisible])

  return <div ref={ref}>{children}</div>
}
