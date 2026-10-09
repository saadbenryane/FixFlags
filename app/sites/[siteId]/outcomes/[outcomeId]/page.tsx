import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OutcomeBindingResult } from '@/components/sites/OutcomeBindingResult'
import { OutcomeEnabledControl } from '@/components/sites/OutcomeEnabledControl'
import { SiteShell } from '@/components/sites/SiteShell'
import { VerifyOutcomeButton } from '@/components/sites/VerifyOutcomeButton'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { customerMechanismLabel, flagMatchesOutcome, outcomeCoverageLabel, outcomeFreshnessDisclosure, outcomeStatusLabel } from '@/lib/sites/outcome-state'
import { loadSiteOutcomeDetail } from '@/lib/sites/outcomes'
import { requireSiteAccess } from '@/lib/sites/request-access'
import { formatEvidenceTimestamp } from '@/lib/time/format'

export default async function OutcomeDetailPage({ params }: {
  params: Promise<{ siteId: string; outcomeId: string }>
}) {
  const { siteId, outcomeId } = await params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()
  const [home, outcome] = await Promise.all([
    loadSiteHome(access.decision.site.siteId),
    loadSiteOutcomeDetail(access.decision.site, outcomeId),
  ])
  if (!home || !outcome) notFound()
  const relatedFlags = [...new Map(
    [...home.flags, ...home.resolvedFlags]
      .filter((flag) => flagMatchesOutcome(flag, outcome))
      .map((flag) => [flag.id, flag]),
  ).values()]
  const status = outcome.enabled ? outcomeStatusLabel(outcome.state, outcome.running) : OUTCOME_DETAIL_COPY.paused
  const lastVerified = formatEvidenceTimestamp(outcome.lastVerifiedAt)
  const lastSuccessful = formatEvidenceTimestamp(outcome.lastSuccessfulVerificationAt)

  return (
    <SiteShell
      siteId={home.site.siteId}
      ownerId={home.site.userId}
      activeRoute="home"
      title={outcome.name}
      description={outcome.expectation ?? outcome.summary}
      presentation={home.presentation}
      watch={home.watch}
      checking={outcome.running}
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <Link href={`/sites/${home.site.siteId}`} className="text-sm text-muted-foreground hover:text-foreground">
          {OUTCOME_DETAIL_COPY.back}
        </Link>

        <section className="rounded-2xl border border-border/80 bg-background p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{OUTCOME_DETAIL_COPY.state}</p>
              <p className="mt-1 text-2xl font-semibold" role="status">{status}</p>
              <p className="mt-2 text-sm text-muted-foreground">{outcome.summary}</p>
              {outcome.recoveryAction ? <p className="mt-3 text-sm font-medium">{outcome.recoveryAction}</p> : null}
              <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{OUTCOME_DETAIL_COPY.expectedResult}</p>
              <p className="mt-1 text-sm">{outcome.expectation ?? 'No customer result has been confirmed yet.'}</p>
              <p className="mt-3 text-xs text-muted-foreground">{outcomeCoverageLabel(outcome.environment, outcome.bindings)}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {lastVerified
                  ? <>{outcome.state === 'COULD_NOT_VERIFY' ? 'Last attempted' : 'Last verified'} <time dateTime={outcome.lastVerifiedAt ?? undefined}>{lastVerified}</time></>
                  : OUTCOME_DETAIL_COPY.neverVerified}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {OUTCOME_DETAIL_COPY.lastSuccessfulVerification}: {lastSuccessful
                  ? <time dateTime={outcome.lastSuccessfulVerificationAt ?? undefined}>{lastSuccessful}</time>
                  : 'None yet'}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <VerifyOutcomeButton
                siteId={home.site.siteId}
                outcomeId={outcome.id}
                disabled={!outcome.enabled || outcome.running || !outcome.bindings.some((binding) => binding.required)}
              />
              {access.decision.role === 'owner' ? (
                <OutcomeEnabledControl siteId={home.site.siteId} outcomeId={outcome.id} enabled={outcome.enabled} running={outcome.running} />
              ) : null}
            </div>
          </div>
        </section>

        {outcome.limitation ? (
          <section className="rounded-2xl border border-border/80 bg-background p-5" aria-labelledby="outcome-limitation-heading">
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
              <article key={binding.key} className="rounded-2xl border border-border/80 bg-background p-5">
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
                ) : <p className="mt-3 text-sm text-muted-foreground">{OUTCOME_DETAIL_COPY.noEvidence}</p>}
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
                    <Link href={`/sites/${home.site.siteId}/flags/${flag.id}`} className="text-sm font-medium hover:underline">{flag.problem}</Link>
                    <span className="text-xs text-muted-foreground">{flag.status === 'FIXED' ? 'Resolved' : 'Active'}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {outcome.pageUrls.length > 0 ? (
          <section aria-labelledby="outcome-pages-heading">
            <h2 id="outcome-pages-heading" className="text-lg font-semibold">{OUTCOME_DETAIL_COPY.pagesHeading}</h2>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {outcome.pageUrls.map((url) => <li key={url} className="break-all">{url}</li>)}
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
                <li key={event.id} className="rounded-card border border-border/70 p-4">
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

        <details className="rounded-2xl border border-border/80 bg-background p-5">
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
