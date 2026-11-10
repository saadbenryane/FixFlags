import { notFound, redirect } from 'next/navigation'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { requireSitePageAccess } from '@/lib/sites/page-access'
import { SiteBoard } from '@/components/sites/SiteBoard'
import { readWorkspaceLocation } from '@/lib/sites/workspace-location'
import { loadSiteResultsGate } from '@/lib/sites/application/results-gate'
import { SiteResultsGate } from '@/components/sites/SiteResultsGate'
import { AuditShell } from '@/components/layout/audit-shell'

export default async function SiteDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ siteId: string }>
  searchParams: Promise<{ view?: string | string[]; category?: string | string[]; flag?: string | string[] }>
}) {
  const { siteId } = await params
  const { view, category, flag } = await searchParams
  const access = await requireSitePageAccess(siteId, `/sites/${encodeURIComponent(siteId)}`)

  // Owner visits use the claimed project. The browser that started the scan
  // stays on the provisional board, which is the only one that visitor can open.
  const resolvedId = access.decision.site.siteId
  // Results belong to an account. The visitor who started the check watches
  // it run, then signs up; the claim keeps the same Site and evidence.
  if (access.decision.role !== 'owner') {
    const gate = await loadSiteResultsGate(access.decision.site, Boolean(access.decision.authenticated))
    return <AuditShell session={null}><SiteResultsGate initial={gate} /></AuditShell>
  }
  if (view === 'flags') redirect(`/sites/${resolvedId}#website-checks`)
  if (view === 'monitoring') redirect(`/sites/${resolvedId}?view=timeline#timeline`)
  const home = await loadSiteHome(resolvedId, {
    ownerEvidence: true,
    viewerAuthenticated: access.decision.authenticated,
    site: access.decision.site,
  })
  if (!home) notFound()

  const paramsView = new URLSearchParams()
  for (const [key, value] of Object.entries({ view, category, flag })) if (typeof value === 'string') paramsView.set(key, value)
  const location = readWorkspaceLocation(paramsView)
  return <SiteBoard siteId={resolvedId} initial={home} viewMode={location.viewMode} initialCategory={location.selectedCard} initialFlag={location.selectedFlag} />
}
