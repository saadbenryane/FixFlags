import { notFound, redirect } from 'next/navigation'
import { getRequestedPath, signInUrl } from '@/lib/auth/redirect-path'
import { currentSiteViewer, requireSiteAccess, requireSiteOwner } from './request-access'

/** Navigation can offer authentication without revealing whether private data
 * exists. API refusal and current Site authority remain with request-access. */
async function continueDeniedPage(fallbackPath: string): Promise<never> {
  if (!(await currentSiteViewer()).userId) redirect(signInUrl(await getRequestedPath(fallbackPath)))
  notFound()
}

export async function requireSitePageAccess(siteId: string, fallbackPath: string) {
  const access = await requireSiteAccess(siteId)
  return access.ok ? access : continueDeniedPage(fallbackPath)
}

/** Result-bearing pages: a non-owner returns to the Site, where the results
 * gate shows the check and the signup continuation. */
export async function requireSiteResultsPage(siteId: string, fallbackPath: string) {
  const access = await requireSitePageAccess(siteId, fallbackPath)
  if (access.decision.role !== 'owner') redirect(`/sites/${encodeURIComponent(access.decision.site.siteId)}`)
  return access
}

export async function requireSiteOwnerPage(siteId: string, fallbackPath: string) {
  const access = await requireSiteOwner(siteId)
  return access.ok ? access : continueDeniedPage(fallbackPath)
}
