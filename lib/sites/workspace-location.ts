import { siteCardArea, type SiteCardArea } from './card-areas'

export type SiteBoardView = 'home' | 'pages' | 'timeline' | 'integrations'
export type SiteWorkspaceLocation = { viewMode: SiteBoardView; selectedCard: SiteCardArea | null; selectedFlag: string | null }

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
