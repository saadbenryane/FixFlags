import { notFound, redirect } from 'next/navigation'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { SiteBoard, type SiteBoardView } from '@/components/sites/SiteBoard'
import { siteCardArea } from '@/lib/sites/card-areas'

function siteBoardView(value: string | string[] | undefined): SiteBoardView {
  return typeof value === 'string' && ['timeline', 'integrations'].includes(value) ? value as SiteBoardView : 'home'
}

export default async function SiteDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ view?: string | string[]; category?: string | string[] }>
}) {
  const { siteId } = await params
  const { view, category } = await searchParams
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()

  // Owner visits use the claimed project. The browser that started the scan
  // stays on the provisional board, which is the only one that visitor can open.
  const resolvedId = access.decision.site.siteId
  if (view === 'flags') redirect(`/sites/${resolvedId}#website-checks`)
  if (view === 'monitoring') redirect(`/sites/${resolvedId}?view=timeline#timeline`)
  const home = await loadSiteHome(resolvedId, {
    ownerEvidence: access.decision.role === 'owner',
    viewerAuthenticated: access.decision.authenticated,
    site: access.decision.site,
  })
  if (!home) notFound()

  return <SiteBoard siteId={resolvedId} initial={home} viewMode={siteBoardView(view)} initialCategory={siteBoardView(view) === 'home' ? siteCardArea(category) : null} />
}
