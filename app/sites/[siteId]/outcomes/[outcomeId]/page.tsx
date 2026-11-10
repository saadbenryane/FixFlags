import Link from 'next/link'
import { RecordedPageLink } from '@/components/sites/RecordedPageLink'
import type { Route } from 'next'
import { notFound } from 'next/navigation'
import { OutcomeBindingResult } from '@/components/sites/OutcomeBindingResult'
import { SiteOutcomeActions } from '@/components/sites/SiteOutcomeActions'
import { OutcomeStateLabel } from '@/components/sites/OutcomeStateLabel'
import { SiteShell } from '@/components/sites/SiteShell'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy-barrel'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { customerMechanismLabel, outcomeRelatedFlags, outcomeCoverageLabel, outcomeFreshnessDisclosure } from '@/lib/sites/outcome-state'
import { loadSiteOutcomeDetail } from '@/lib/sites/outcomes'
import { requireSiteResultsPage } from '@/lib/sites/page-access'
import { formatEvidenceTimestamp } from '@/lib/time/format'
import { SitePromptCopyButton } from '@/components/sites/SitePromptCopyButton'
import { customerFindingLabel } from '@/lib/sites/finding-label'
import { hasRepairGuidance } from '@/lib/improvements/repair-guidance'
import { SITE_DASHBOARD_COPY } from '@/lib/marketing/copy/site-dashboard'
import { SITE_WORKSPACE_COPY } from '@/lib/marketing/copy/workspace'
import { siteDetailContextHref, siteDetailReturnDestination, type SiteDetailOriginParams } from '@/lib/sites/workspace-location'

export default async function OutcomeDetailPage({ params, searchParams }: {
  params: Promise<{ siteId: string; outcomeId: string }>
  searchParams?: Promise<SiteDetailOriginParams>
}) {
  const { siteId, outcomeId } = await params
  const origin = await searchParams ?? {}
  const access = await requireSiteResultsPage(siteId, `/sites/${encodeURIComponent(siteId)}/outcomes/${encodeURIComponent(outcomeId)}`)
  const [home, outcome] = await Promise.all([
    loadSiteHome(access.decision.site.siteId, { ownerEvidence: access.decision.role === 'owner', viewerAuthenticated: access.decision.authenticated, site: access.decision.site }),
    loadSiteOutcomeDetail(access.decision.site, outcomeId),
  ])
  if (!home || !outcome) notFound()
  const returnDestination = siteDetailReturnDestination(home.site.siteId, null, origin)
  const relatedFlags = outcomeRelatedFlags(home.flags, home.resolvedFlags, outcome)
  const lastVerified = formatEvidenceTimestamp(outcome.lastVerifiedAt)
  const lastSuccessful = formatEvidenceTimestamp(outcome.lastSuccessfulVerificationAt)

  return (
    <SiteShell
      actions={home.actions}
      siteId={home.site.siteId}
      activeRoute="home"
      title={outcome.name}
      description=""
      presentation={home.presentation}
      analysisView={home}
      watch={home.watch}
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link href={returnDestination.href as Route} className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">
          {returnDestination.view === 'home' ? OUTCOME_DETAIL_COPY.back : SITE_DASHBOARD_COPY.backTo(SITE_WORKSPACE_COPY.navigation[returnDestination.view])}
        </Link>

        <section className="rounded-card bg-muted/20 p-5 sm:p-6">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">{OUTCOME_DETAIL_COPY.state}</p>
              <p className="mt-1 text-2xl font-semibold" role="status"><OutcomeStateLabel state={outcome.state} validUntil={outcome.validUntil} running={outcome.running} enabled={outcome.enabled} /></p>
              <p className="mt-2 text-sm text-muted-foreground">{outcome.summary}</p>
              {outcome.recoveryAction && !outcome.running ? <p className="mt-3 text-sm font-medium">{outcome.recoveryAction}</p> : null}
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{OUTCOME_DETAIL_COPY.expectedResult}</p>
              <p className="mt-1 text-sm">{outcome.expectation ?? 'No customer result has been confirmed yet.'}</p>
              <p className="mt-3 text-xs text-muted-foreground">{outcomeCoverageLabel(outcome.environment, outcome.bindings)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lastVerified
                  ? <>{outcome.state === 'COULD_NOT_VERIFY' ? 'Last attempted' : 'Last verified'} <time dateTime={outcome.lastVerifiedAt ?? undefined}>{lastVerified}</time></>
                  : OUTCOME_DETAIL_COPY.neverVerified}
              </p>
              {outcome.lastSuccessfulVerificationAt !== outcome.lastVerifiedAt ? <p className="mt-1 text-xs text-muted-foreground">
                {OUTCOME_DETAIL_COPY.lastSuccessfulVerification}: {lastSuccessful
                  ? <time dateTime={outcome.lastSuccessfulVerificationAt ?? undefined}>{lastSuccessful}</time>
                  : 'None yet'}
              </p> : null}
            </div>
            <div className="flex min-w-0 flex-col items-start gap-3">
              <SiteOutcomeActions siteId={home.site.siteId} initial={outcome} initialView={home} />
            </div>
          </div>
        </section>

        {outcome.limitation && outcome.limitation !== outcome.summary ? (
          <section className="rounded-card bg-muted/20 p-5" aria-labelledby="outcome-limitation-heading">
            <h2 id="outcome-limitation-heading" className="text-lg font-semibold">{OUTCOME_DETAIL_COPY.limitationHeading}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{outcome.limitation}</p>
          </section>
        ) : null}

        <section aria-labelledby="outcome-evidence-heading">
          <h2 id="outcome-evidence-heading" className="text-lg font-semibold">{OUTCOME_DETAIL_COPY.evidenceHeading}</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {outcome.bindings.map((binding) => {
              const observed = binding.latestEvidence ? formatEvidenceTimestamp(binding.latestEvidence.createdAt) : null
              return (
              <article key={binding.key} className="rounded-card bg-muted/20 p-5">
                <p className="text-sm font-semibold">{customerMechanismLabel(binding.mechanism, binding.key)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{binding.required ? 'Required for Clear' : 'Supporting evidence'}</p>
                {binding.latestEvidence ? (
                  <>
                    <OutcomeBindingResult
                      bindingKey={binding.key}
                      disposition={binding.latestEvidence.disposition}
                      reason={binding.latestEvidence.reason}
                    />
                    {observed ? (
                      <p className="mt-2 text-xs text-muted-foreground">Observed <time dateTime={binding.latestEvidence.createdAt}>{observed}</time></p>
                    ) : null}
                    {binding.latestEvidence.detail ? (
                      <details className="mt-3 text-xs text-muted-foreground">
                        <summary className="cursor-pointer min-h-11 py-3">Technical evidence</summary>
                        <pre className="overflow-x-auto whitespace-pre-wrap rounded-card bg-muted p-3">{JSON.stringify(binding.latestEvidence.detail, null, 2)}</pre>
                      </details>
                    ) : null}
                  </>
                ) : <p className="mt-3 text-sm text-muted-foreground">{binding.customerSentence}</p>}
              </article>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="outcome-flags-heading">
          <h2 id="outcome-flags-heading" className="text-lg font-semibold">{OUTCOME_DETAIL_COPY.flagsHeading}</h2>
          {relatedFlags.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{OUTCOME_DETAIL_COPY.noFlags}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {relatedFlags.map((flag) => (
                <li key={flag.id} className="rounded-card border border-brand p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <Link href={siteDetailContextHref(`/sites/${home.site.siteId}/flags/${encodeURIComponent(flag.id)}`, returnDestination.origin) as Route} className="inline-flex min-h-11 max-w-full items-center text-sm font-medium hover:underline">{customerFindingLabel(flag)}</Link>
                    <span className="text-xs text-muted-foreground">{flag.status === 'FIXED' || flag.status === 'VERIFIED' ? 'Resolved' : 'Active'}</span>
                  </div>
                  {home.flags.some(current => current.id === flag.id) && (home.actions.copy !== 'available' || hasRepairGuidance(flag.fix)) ? <SitePromptCopyButton siteId={home.site.siteId} flagId={flag.id} flagTitle={customerFindingLabel(flag)} availability={home.actions.copy} compact /> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {outcome.pageUrls.length > 0 ? (
          <section aria-labelledby="outcome-pages-heading">
            <h2 id="outcome-pages-heading" className="text-lg font-semibold">{OUTCOME_DETAIL_COPY.pagesHeading}</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {outcome.pageUrls.map((url) => <li key={url} className="break-all"><RecordedPageLink url={url}
                className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-control hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" /></li>)}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="outcome-history-heading">
          <h2 id="outcome-history-heading" className="text-lg font-semibold">{OUTCOME_DETAIL_COPY.historyHeading}</h2>
          {outcome.timeline.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">{OUTCOME_DETAIL_COPY.noHistory}</p> : (
            <ol className="mt-3 space-y-3">
              {outcome.timeline.map((event) => {
                const when = formatEvidenceTimestamp(event.at)
                return (
                <li key={event.id} className="rounded-card bg-muted/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium">{event.title}</p>
                    {when ? <time className="text-xs text-muted-foreground" dateTime={event.at}>{when}</time> : null}
                  </div>
                  {event.detail ? <p className="mt-1 text-sm text-muted-foreground">{event.detail}</p> : null}
                </li>
                )
              })}
            </ol>
          )}
        </section>

        <details className="rounded-card bg-muted/20 p-5">
          <summary className="cursor-pointer min-h-11 py-2 text-sm font-semibold">{OUTCOME_DETAIL_COPY.mechanismHeading}</summary>
          <p className="mt-2 text-sm text-muted-foreground">Environment: {outcome.environment}. {outcomeFreshnessDisclosure(outcome.state, outcome.staleAfterMinutes)}</p>
          <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
            {outcome.bindings.map((binding) => <li key={binding.key}>{binding.customerSentence}</li>)}
          </ul>
        </details>
      </div>
    </SiteShell>
  )
}
