import type { SiteRecord } from '../types'

export type SiteContext =
  | { role: 'owner'; site: SiteRecord & { projectId: string; userId: string }; userId: string }
  | { role: 'provisional_session'; site: SiteRecord; userId: null }

export function ownedSiteContext(site: SiteRecord, userId: string): SiteContext & { role: 'owner' } {
  if (!site.projectId || site.userId !== userId) throw new Error('Site not found')
  return { role: 'owner', site: { ...site, projectId: site.projectId, userId }, userId }
}
