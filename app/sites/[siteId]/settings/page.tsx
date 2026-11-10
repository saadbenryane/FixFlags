import { notFound } from 'next/navigation'
import { SiteSettingsView } from '@/components/sites/SiteSettingsView'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSiteOwnerPage } from '@/lib/sites/page-access'
import { listOutcomeFixtures } from '@/lib/sites/application/outcome-fixtures'

export default async function SiteSettingsPage({ params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params
  const access = await requireSiteOwnerPage(siteId, `/sites/${encodeURIComponent(siteId)}/settings`)
  const resolvedId = access.decision.site.siteId
  const projectId = access.decision.site.projectId
  const [home, fixtures] = await Promise.all([
    loadSiteHome(resolvedId, { ownerEvidence: true, readScope: 'settings', site: access.decision.site }),
    projectId ? listOutcomeFixtures(projectId) : Promise.resolve([]),
  ])
  if (!home) notFound()
  return <SiteSettingsView siteId={resolvedId} view={home} fixtures={fixtures} />
}
