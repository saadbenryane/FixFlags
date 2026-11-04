'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import type { Route } from 'next'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { SITE_BOARD_COPY } from '@/lib/marketing/copy/terminology'
import { SITE_DASHBOARD_COPY as C } from '@/lib/marketing/copy/site-dashboard'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { useSiteFlagDetail } from '@/hooks/useSiteFlagDetail'
import { ResponsiveDepth } from './ResponsiveDepth'
import { customerFindingLabel } from '@/lib/sites/finding-label'
import { siteDetailContextHref } from '@/lib/sites/workspace-location'
import { useSiteWorkspaceLocation } from './SiteWorkspaceLocation'

const SiteFlagContent = dynamic(() => import('./SiteFlagContent').then(module => module.SiteFlagContent), {
  loading: () => <p role="status" className="min-h-40 text-sm text-muted-foreground">{C.loadingFlag}</p>,
})

export function SiteFlagPanel({ siteId, flagId, view, onClose, restoreFocus, returnLabel }: {
  siteId: string; flagId: string | null; view: SiteHomeView; onClose: () => void; restoreFocus: () => void; returnLabel?: string;
}) {
  const origin = useSiteWorkspaceLocation()
  const seed = [...view.flags, ...view.resolvedFlags].find(flag => flag.id === flagId || flag.sourceFlagId === flagId)
  // Timeline entries arrive newest first. Refresh from the latest linked check.
  const latestCheck = view.monitoringHistory?.find(entry => entry.flags?.some(flag => flag.id === flagId || flag.id === seed?.sourceFlagId))
  const lifecycle = JSON.stringify([view.audit?.id, seed?.sourceFlagId, seed?.status, seed?.verificationState,
    seed?.latestOccurrenceAt, seed?.resolvedInId, seed?.repairEvidenceRevision, seed?.repairGuidance, latestCheck?.id, view.actions.copy])
  const resource = useSiteFlagDetail(siteId, flagId, lifecycle, view.actions.copy === 'available')
  const flag = resource.data?.flag
  return <ResponsiveDepth open={Boolean(flagId)} onOpenChange={open => { if (!open) onClose() }}
    header={<div className="space-y-2">{returnLabel ? <Button variant="ghost" size="sm" onClick={onClose}><ArrowLeft aria-hidden />{C.backTo(returnLabel)}</Button> : null}<DialogTitle>{flag || seed ? customerFindingLabel((flag ?? seed)!) : SITE_BOARD_COPY.openFlag}</DialogTitle></div>}
    className="max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); restoreFocus() }}>
    <DialogDescription className={flag || seed ? undefined : 'sr-only'}>{flag?.whyItMatters || seed?.whyItMatters || C.loadingFlag}</DialogDescription>
    <SiteFlagContent siteId={siteId} flagId={flagId} view={view} seed={seed} resource={resource} />
    {flagId ? <Button asChild variant="ghost" className="justify-start"><Link href={siteDetailContextHref(`/sites/${siteId}/flags/${encodeURIComponent(flagId)}`, origin) as Route}>{C.fullFlag}</Link></Button> : null}
  </ResponsiveDepth>
}
