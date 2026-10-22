import type { SiteRecord } from '../types'
import { SiteNotFound } from './site-errors'

export type SiteContext =
  | { role: 'owner'; site: SiteRecord & { projectId: string; userId: string }; userId: string }
  | { role: 'provisional_session'; site: SiteRecord; userId: null }

/** The one rule that decides whether a caller owns a Site. A Site without an
 * owning account, or one owned by somebody else, is not found for that
 * caller. */
export function ownedSiteContext(site: SiteRecord, userId: string): SiteContext & { role: 'owner' } {
  if (!site.projectId || site.userId !== userId) throw new SiteNotFound()
  return { role: 'owner', site: { ...site, projectId: site.projectId, userId }, userId }
}
