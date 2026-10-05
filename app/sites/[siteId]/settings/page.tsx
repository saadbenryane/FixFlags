import { notFound } from 'next/navigation'
import { SiteSettingsView } from '@/components/sites/SiteSettingsView'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { listOutcomeFixtures } from '@/lib/sites/application/outcome-fixtures'

export default async function SiteSettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()
  const resolvedId = access.decision.site.siteId
  const home = await loadSiteHome(resolvedId)
  if (!home) notFound()
  const fixtures = access.decision.role === 'owner' && access.decision.site.projectId
    ? await listOutcomeFixtures(access.decision.site.projectId)
    : []
  return <SiteSettingsView siteId={resolvedId} view={home} fixtures={fixtures} />
}
