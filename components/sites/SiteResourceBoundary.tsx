'use client'

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { useSiteResource, type SiteResourceUpdate } from '@/hooks/useSiteResource'
import type { SiteHomeView } from '@/lib/sites/application/queries'

type Observer = (update: SiteResourceUpdate) => void
type SharedResource = ReturnType<typeof useSiteResource> & { siteId: string; subscribe: (observer: Observer) => () => void }
const SiteResourceContext = createContext<SharedResource | null>(null)

/** One read, polling and event owner for all consumers of a composed Site view. */
export function SiteResourceBoundary({ siteId, initial, children }: { siteId: string; initial: SiteHomeView; children: ReactNode }) {
  const existing = useContext(SiteResourceContext)
  if (existing?.siteId === siteId) return children
  return <SiteResourceOwner key={siteId} siteId={siteId} initial={initial}>{children}</SiteResourceOwner>
}

function SiteResourceOwner({ siteId, initial, children }: { siteId: string; initial: SiteHomeView; children: ReactNode }) {
  const observers = useMemo(() => new Set<Observer>(), [])
  const notify = useCallback((update: SiteResourceUpdate) => {
    for (const observer of observers) observer(update)
  }, [observers])
  const subscribe = useCallback((observer: Observer) => {
    observers.add(observer)
    return () => { observers.delete(observer) }
  }, [observers])
  const { view, refresh, disconnected } = useSiteResource(siteId, initial, notify)
  const resource = useMemo(() => ({ siteId, view, refresh, disconnected, subscribe }), [siteId, view, refresh, disconnected, subscribe])
  return <SiteResourceContext.Provider value={resource}>{children}</SiteResourceContext.Provider>
}

export function useSharedSiteResource(siteId: string, onUpdate?: Observer) {
  const resource = useContext(SiteResourceContext)
  const observer = useRef(onUpdate)
  useLayoutEffect(() => { observer.current = onUpdate }, [onUpdate])
  const subscribe = resource?.siteId === siteId ? resource.subscribe : undefined
  useEffect(() => subscribe?.(update => observer.current?.(update)), [subscribe])
  if (!resource || resource.siteId !== siteId) throw new Error('Site resource boundary does not match the requested Site')
  return resource
}
