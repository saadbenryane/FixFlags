'use client'

import type { SiteHomeView } from '@/lib/sites/site-home'
import { useSiteDetailRefresh } from '@/hooks/useSiteDetailRefresh'
import { useSharedSiteResource } from './SiteResourceBoundary'

function resolutionRevision(view: SiteHomeView, flagId: string, sourceFlagId: string) {
  const flag = [...view.flags, ...view.resolvedFlags].find(item => item.id === flagId || item.sourceFlagId === flagId || item.sourceFlagId === sourceFlagId)
  const check = view.monitoringHistory.find(item => item.flags?.some(candidate => candidate.id === flagId || candidate.id === sourceFlagId || candidate.id === flag?.sourceFlagId))
  return JSON.stringify([flag?.sourceFlagId, flag?.status, flag?.verificationState, flag?.latestOccurrenceAt, flag?.resolvedInId, check?.id, view.actions])
}

/** Server-rendered proof and history follow the selected Flag, including pages without repair controls. */
export function SiteFlagDetailRefresh({ siteId, flagId, sourceFlagId, initial }: {
  siteId: string; flagId: string; sourceFlagId: string; initial: SiteHomeView;
}) {
  const { view, readUnavailable } = useSharedSiteResource(siteId)
  const baseline = resolutionRevision(initial, flagId, sourceFlagId)
  const revision = resolutionRevision(view, flagId, sourceFlagId)
  useSiteDetailRefresh(JSON.stringify(['flag', siteId, flagId, sourceFlagId]), baseline, revision, readUnavailable || Boolean(view.recoveryUnavailable))
  return null
}
