import { notFound } from 'next/navigation'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { SiteBoard } from '@/components/sites/SiteBoard'

export default async function SiteDashboardPage({
  params,
}: {
  params: Promise<{ siteId: string }>
}) {
  const { siteId } = await params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()

  // Prefer stable project id once claimed.
  const resolvedId = access.decision.site.siteId
  const home = await loadSiteHome(resolvedId)
  if (!home) notFound()

  return <SiteBoard siteId={resolvedId} initial={home} />
}
