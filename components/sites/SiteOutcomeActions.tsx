'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { useSharedSiteResource } from './SiteResourceBoundary'
import { VerifyOutcomeButton } from './VerifyOutcomeButton'
import { OutcomeEnabledControl } from './OutcomeEnabledControl'
import { SiteActionContinuation } from './SiteActionContinuation'

/** Live controls and server-rendered evidence observe the same Site resource. */
export function SiteOutcomeActions({ siteId, initial }: { siteId: string; initial: SiteOutcomeView }) {
  const router = useRouter()
  const { view, refresh, disconnected } = useSharedSiteResource(siteId)
  // Retained detail routes can describe an Outcome outside the current summary.
  const outcome = view.outcomes.find(item => item.id === initial.id) ?? initial
  const revision = JSON.stringify([outcome, view.activeRuns.map(run => [run.id, run.status]), view.actions])
  const rendered = useRef(revision)
  useEffect(() => {
    if (rendered.current === revision) return
    rendered.current = revision
    router.refresh()
  }, [revision, router])

  return <>
    {view.actions.check === 'available' ? <VerifyOutcomeButton siteId={siteId} outcomeId={outcome.id} running={outcome.running}
      disabled={disconnected || !outcome.enabled || !outcome.bindings.some(binding => binding.required)}
      onRefresh={refresh} /> : <SiteActionContinuation availability={view.actions.check}
      destination={`/sites/${siteId}/outcomes/${outcome.id}`} action="check" label={SITE_ACTION_COPY.outcome.verify} />}
    {view.actions.ownership === 'owner' ? <OutcomeEnabledControl siteId={siteId} outcomeId={outcome.id}
      enabled={outcome.enabled} running={outcome.running} onRefresh={refresh} /> : null}
  </>
}
