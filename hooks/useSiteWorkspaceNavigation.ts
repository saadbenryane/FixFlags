'use client'

import { useEffect, useRef, useState } from 'react'
import { readWorkspaceLocation, type SiteBoardView, type SiteWorkspaceLocation } from '@/lib/sites/workspace-location'
import type { SiteCardArea } from '@/lib/sites/card-areas'

export function useSiteWorkspaceNavigation(siteId: string, initial: SiteWorkspaceLocation) {
  const { viewMode, selectedCard, selectedFlag } = initial
  const [location, setLocation] = useState(initial)
  const previousView = useRef(location.viewMode)
  const destination = useRef<{ siteId: string; view: SiteBoardView; id: string } | null>(null)
  useEffect(() => {
    const changed = previousView.current !== location.viewMode
    previousView.current = location.viewMode
    const requested = destination.current
    destination.current = null
    if (requested?.siteId === siteId && requested.view === location.viewMode && !location.selectedFlag && !location.selectedCard) {
      const target = document.getElementById(requested.id)
      if (target) { target.focus({ preventScroll: true }); target.scrollIntoView({ behavior: 'instant', block: 'start' }); return }
    }
    // In-place route changes need the same focus destination as a page load.
    // Detail dialogs own their focus and Back keeps the browser's scroll position.
    if (changed && !location.selectedFlag && !location.selectedCard) {
      const main = document.getElementById('main-content')
      const target = main?.querySelector<HTMLElement>('h1') ?? main
      target?.focus({ preventScroll: true })
    }
  }, [location, siteId])
  useEffect(() => { setLocation({ viewMode, selectedCard, selectedFlag }) }, [siteId, viewMode, selectedCard, selectedFlag])
  useEffect(() => {
    const restore = () => { destination.current = null; setLocation(readWorkspaceLocation(new URLSearchParams(window.location.search))) }
    window.addEventListener('popstate', restore)
    return () => window.removeEventListener('popstate', restore)
  }, [])
  function publish(url: URL, method: 'pushState' | 'replaceState', state: unknown = null) {
    setLocation(readWorkspaceLocation(url.searchParams))
    const href = url.pathname + url.search + url.hash
    if (href !== window.location.pathname + window.location.search + window.location.hash) window.history[method](state, '', href)
  }
  function openWorkspace(view: SiteBoardView, targetId?: string) {
    const url = new URL(window.location.href)
    url.searchParams.delete('category'); url.searchParams.delete('flag')
    if (view === 'home') url.searchParams.delete('view')
    else url.searchParams.set('view', view)
    url.hash = targetId || (view === 'home' ? '' : view)
    destination.current = targetId ? { siteId, view, id: targetId } : null
    publish(url, 'pushState')
    if (!targetId) window.scrollTo(0, 0)
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
