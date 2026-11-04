import { siteCardArea, type SiteCardArea } from './card-areas'

export type SiteBoardView = 'home' | 'pages' | 'timeline' | 'integrations'
export type SiteWorkspaceLocation = { viewMode: SiteBoardView; selectedCard: SiteCardArea | null; selectedFlag: string | null }
export type SiteWorkspaceOrigin = { siteId: string; viewMode: SiteBoardView; selectedCard: SiteCardArea | null }
export type SiteDetailOriginParams = { view?: string | string[]; category?: string | string[] }

export function readWorkspaceLocation(params: URLSearchParams): SiteWorkspaceLocation {
  const requested = params.get('view')
  const viewMode = requested === 'pages' || requested === 'timeline' || requested === 'integrations' ? requested : 'home'
  const flag = params.get('flag')
  return { viewMode, selectedCard: viewMode === 'home' ? siteCardArea(params.get('category')) : null,
    selectedFlag: flag && flag.length <= 200 ? flag : null }
}

export function siteWorkspaceHref(siteId: string, view: SiteBoardView | 'settings') {
  const base = `/sites/${encodeURIComponent(siteId)}`
  return view === 'home' ? base : view === 'settings' ? `${base}/settings` : `${base}?view=${view}#${view}`
}

/** Carry only the owning workspace, never a nested detail or an arbitrary return URL. */
export function siteDetailContextHref(href: string, origin: SiteWorkspaceOrigin | null): string {
  if (!origin) return href
  const base = `/sites/${encodeURIComponent(origin.siteId)}/`
  if (!href.startsWith(base)) return href
  const url = new URL(href, 'https://fixflags.invalid')
  if (url.origin !== 'https://fixflags.invalid' || !url.pathname.startsWith(base)) return href
  const [collection, id, nested] = url.pathname.slice(base.length).split('/')
  if (!['flags', 'outcomes'].includes(collection) || !id || nested !== undefined) return href
  url.searchParams.set('view', origin.viewMode)
  url.searchParams.delete('category')
  if (origin.viewMode === 'home' && origin.selectedCard) url.searchParams.set('category', origin.selectedCard)
  return url.pathname + url.search + url.hash
}

export function siteDetailReturnDestination(siteId: string, area: SiteCardArea | null, origin: SiteDetailOriginParams) {
  const validView = typeof origin.view === 'string' && ['home', 'pages', 'timeline', 'integrations'].includes(origin.view)
  const location = validView ? readWorkspaceLocation(new URLSearchParams({ view: origin.view as string,
    ...(typeof origin.category === 'string' ? { category: origin.category } : {}) })) : { viewMode: 'home' as const, selectedCard: area }
  const root = siteWorkspaceHref(siteId, location.viewMode)
  return { view: location.viewMode, origin: { siteId, viewMode: location.viewMode, selectedCard: location.selectedCard }, href: location.viewMode === 'home' && location.selectedCard
    ? `${root}?category=${location.selectedCard}#category-${location.selectedCard}` : root }
}
