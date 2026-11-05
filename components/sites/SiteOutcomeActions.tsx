'use client'

import { useState } from 'react'
import type { SiteOutcomeView } from '@/lib/sites/outcomes'
import type { SiteHomeView } from '@/lib/sites/site-home'
import { useSiteDetailRefresh } from '@/hooks/useSiteDetailRefresh'
import { outcomeRelatedFlags } from '@/lib/sites/outcome-state'
import { hasRepairGuidance } from '@/lib/improvements/repair-guidance'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'
import { useSharedSiteResource } from './SiteResourceBoundary'
import { VerifyOutcomeButton } from './VerifyOutcomeButton'
import { OutcomeEnabledControl, type OutcomeEnabledReceipt } from './OutcomeEnabledControl'
import { OutcomeNameControl } from './OutcomeNameControl'
import { SiteActionContinuation } from './SiteActionContinuation'

function detailRevision(view: SiteHomeView, outcome: SiteOutcomeView) {
  const related = outcomeRelatedFlags(view.flags, view.resolvedFlags, outcome)
  const inSummary = view.outcomes.some(item => item.id === outcome.id)
  // Retained detail outside the summary keeps its existing run observation.
  const runs = view.activeRuns.filter(run => !inSummary || run.id === outcome.latestRunId)
  // Compare the common summary fields, excluding detail-only binding receipts.
  return JSON.stringify([
    outcome.id, outcome.name, outcome.slug, outcome.description, outcome.inferenceSource, outcome.confirmedAt,
    outcome.pageIds, outcome.kind, outcome.criticality, outcome.enabled, outcome.running, outcome.state, outcome.summary, outcome.expectation,
    outcome.environment, outcome.staleAfterMinutes, outcome.lastVerifiedAt, outcome.validUntil, outcome.latestRunId,
    outcome.flagId, outcome.coverage, outcome.pageUrls,
    outcome.bindings.map(binding => [binding.key, binding.required, binding.scope, binding.mechanism, binding.version])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    related.map(flag => [flag.id, flag.problem, flag.checkId, flag.status, hasRepairGuidance(flag.fix), flag.repairGuidance])
      .sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
    runs.map(run => [run.id, run.status]).sort((left, right) => left[0].localeCompare(right[0])), view.actions,
  ])
}

/** Live controls and server-rendered evidence observe the same Site resource. */
export function SiteOutcomeActions({ siteId, initial, initialView }: { siteId: string; initial: SiteOutcomeView; initialView: SiteHomeView }) {
  const { view, refresh, readUnavailable } = useSharedSiteResource(siteId)
  // Retained detail routes can describe an Outcome outside the current summary.
  const current = view.outcomes.find(item => item.id === initial.id)
  // The accompanying summary can predate its independently read detail. Only
  // a later source read can replace that rendered verification activity.
  const summary = current && (view.readAt === undefined || initialView.readAt === undefined || view.readAt > initialView.readAt) ? current : null
  const outcome = summary ?? initial
  const source = JSON.stringify([siteId, outcome.id, view.site.userId, view.actions.ownership, summary ? view.readAt : initialView.readAt, outcome.enabled, outcome.running])
  const [accepted, setAccepted] = useState<(OutcomeEnabledReceipt & { source: string }) | null>(null)
  // A command receipt can update controls before the next source read. It
  // never replaces recorded evidence or survives a changed source or owner.
  if (accepted && accepted.source !== source) setAccepted(null)
  const receipt = accepted?.source === source ? accepted : null
  const enabled = receipt?.enabled ?? outcome.enabled
  const running = outcome.running || Boolean(receipt?.verificationQueued)
  useSiteDetailRefresh(JSON.stringify(['outcome', siteId, initial.id]), detailRevision(initialView, initial),
    detailRevision(view, outcome), readUnavailable || Boolean(view.recoveryUnavailable))

  return <>
    {view.actions.check === 'available' ? <VerifyOutcomeButton siteId={siteId} outcomeId={outcome.id} running={running}
      disabled={readUnavailable || Boolean(view.recoveryUnavailable) || !enabled || !outcome.bindings.some(binding => binding.required)}
      onRefresh={refresh} onAccepted={() => setAccepted(previous => ({ source,
        enabled: previous?.source === source ? previous.enabled : enabled, verificationQueued: true }))} /> : <SiteActionContinuation availability={view.actions.check}
      destination={`/sites/${siteId}/outcomes/${outcome.id}`} action="check" label={SITE_ACTION_COPY.outcome.verify} />}
    {view.actions.ownership === 'owner' ? <OutcomeEnabledControl siteId={siteId} outcomeId={outcome.id}
      enabled={enabled} running={running} onRefresh={refresh} onAccepted={receipt => setAccepted(previous => ({ ...receipt, source,
        // Pausing future checks does not cancel an accepted verification.
        verificationQueued: receipt.verificationQueued || Boolean(previous?.source === source && previous.verificationQueued) }))} /> : null}
    {view.actions.ownership === 'owner' ? <OutcomeNameControl siteId={siteId} outcomeId={outcome.id} name={outcome.name} onRefresh={refresh} /> : null}
  </>
}
