import { notFound } from 'next/navigation'
import { SiteBoard } from '@/components/sites/SiteBoard'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'

export default async function SiteFlagsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()
  const resolvedId = access.decision.site.siteId
  const home = await loadSiteHome(resolvedId)
  if (!home) notFound()
  return <SiteBoard siteId={resolvedId} initial={home} activeView="flags" />
}
