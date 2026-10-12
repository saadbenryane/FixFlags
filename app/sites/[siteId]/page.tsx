import { notFound, redirect } from 'next/navigation'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { SiteBoard, type SiteBoardView } from '@/components/sites/SiteBoard'

function siteBoardView(value: string | string[] | undefined): SiteBoardView {
  return typeof value === 'string' && ['timeline', 'integrations'].includes(value) ? value as SiteBoardView : 'home'
}

export default async function SiteDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ view?: string | string[] }>
}) {
  const { siteId } = await params
  const { view } = await searchParams
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()

  // Prefer stable project id once claimed.
  const resolvedId = access.decision.site.siteId
  if (view === 'flags') redirect(`/sites/${resolvedId}#website-checks`)
  if (view === 'monitoring') redirect(`/sites/${resolvedId}?view=timeline#timeline`)
  const home = await loadSiteHome(resolvedId, { ownerEvidence: access.decision.role === 'owner' })
  if (!home) notFound()

  return <SiteBoard siteId={resolvedId} initial={home} viewMode={siteBoardView(view)} />
}
