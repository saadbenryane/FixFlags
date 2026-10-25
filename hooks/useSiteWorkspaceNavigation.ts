'use client'

import { useEffect, useState } from 'react'
import { readWorkspaceLocation, type SiteBoardView, type SiteWorkspaceLocation } from '@/lib/sites/workspace-location'
import type { SiteCardArea } from '@/lib/sites/card-areas'

export function useSiteWorkspaceNavigation(siteId: string, initial: SiteWorkspaceLocation) {
  const { viewMode, selectedCard, selectedFlag } = initial
  const [location, setLocation] = useState(initial)
  useEffect(() => { setLocation({ viewMode, selectedCard, selectedFlag }) }, [siteId, viewMode, selectedCard, selectedFlag])
  useEffect(() => {
    const restore = () => setLocation(readWorkspaceLocation(new URLSearchParams(window.location.search)))
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  function publish(url: URL, method: 'pushState' | 'replaceState', state: unknown = null) {
    setLocation(readWorkspaceLocation(url.searchParams))
    const href = url.pathname + url.search + url.hash
    if (href !== window.location.pathname + window.location.search + window.location.hash) window.history[method](state, '', href)
  }
  function openWorkspace(view: SiteBoardView) {
    const url = new URL(window.location.href)
    url.searchParams.delete('category'); url.searchParams.delete('flag')
    if (view === 'home') url.searchParams.delete('view')
    else url.searchParams.set('view', view)
    url.hash = view === 'home' ? '' : view
    publish(url, 'pushState')
    window.scrollTo(0, 0)
  }
  function selectCategory(area: SiteCardArea | null) {
    const url = new URL(window.location.href)
    if (area) url.searchParams.set('category', area)
    else url.searchParams.delete('category')
    publish(url, 'replaceState')
  }
  function openFlag(id: string) {
    const url = new URL(window.location.href)
    url.searchParams.set('flag', id)
    publish(url, 'pushState', { fixflagsFlag: id, fixflagsSite: siteId })
  }
  function closeFlag() {
    setLocation(previous => ({ ...previous, selectedFlag: null }))
    if (window.history.state?.fixflagsFlag === location.selectedFlag && window.history.state?.fixflagsSite === siteId) {
      window.history.back(); return
    }
    const url = new URL(window.location.href)
    url.searchParams.delete('flag')
    publish(url, 'replaceState')
  }
  return { ...location, openWorkspace, selectCategory, openFlag, closeFlag }
}
