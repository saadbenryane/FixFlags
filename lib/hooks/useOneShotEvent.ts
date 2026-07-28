'use client'

import { useEffect, useRef } from 'react'
import { trackEvent } from '@/lib/analytics/events'
import type { FunnelEvent } from '@/lib/analytics/events'

export function useOneShotEvent<T extends FunnelEvent>(
  eventName: T,
  auditId: string,
  buildPayload: () => Record<string, unknown> | null,
  deps: unknown[],
) {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    const payload = buildPayload()
    if (!payload) return

    const storageKey = `fixflags:event:${eventName}:${auditId}`
    if (typeof window !== 'undefined' && window.sessionStorage.getItem(storageKey)) {
      firedRef.current = true
      return
    }
    if (typeof window !== 'undefined') window.sessionStorage.setItem(storageKey, '1')
    // trackEvent is typed per-event; the generic hook forwards a dynamic name.
    ;(trackEvent as (name: string, params: Record<string, unknown>) => void)(eventName, {
      audit_id: auditId,
      ...payload,
    })
    firedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
