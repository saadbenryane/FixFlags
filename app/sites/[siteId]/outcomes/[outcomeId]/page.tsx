import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Logo } from '@/components/brand/Logo'
import { SiteChromeAuth } from '@/components/sites/SiteChromeAuth'
import { VerifyOutcomeButton } from '@/components/sites/VerifyOutcomeButton'
import { loadSiteHome } from '@/lib/sites/application/queries'
import { flagMatchesOutcome, outcomeCoverageLabel, outcomeStatusLabel } from '@/lib/sites/outcome-state'
import { requireSiteAccess } from '@/lib/sites/request-access'

export default async function OutcomeDetailPage({
  params,
}: {
  params: Promise<{ siteId: string; outcomeId: string }>
}) {
  const { siteId, outcomeId } = await params
  const access = await requireSiteAccess(siteId)
  if (!access.ok) notFound()
  const home = await loadSiteHome(access.decision.site.siteId)
  const outcome = home?.outcomes.find((item) => item.id === outcomeId)
  if (!home || !outcome) notFound()
  const relatedFlags = home.flags.filter((flag) => flagMatchesOutcome(flag, outcome))

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Logo variant="lockup" size="sm" />
        <SiteChromeAuth />
      </div>
      <Link href={`/sites/${home.site.siteId}`} className="text-sm text-muted-foreground hover:text-foreground">
        Back to {home.host}
      </Link>
      <p className="mt-6 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Outcome</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <h1 className="text-2xl font-semibold">{outcome.name}</h1>
        <p className="text-sm font-medium" role="status">{outcomeStatusLabel(outcome.state, outcome.running)}</p>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{outcome.expectation ?? outcome.summary}</p>
      <p className="mt-2 text-sm text-muted-foreground">{outcomeCoverageLabel(outcome.environment, outcome.bindings)}</p>
      {outcome.summary ? <p className="mt-4 text-sm">{outcome.summary}</p> : null}
      {outcome.lastVerifiedAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {outcome.state === 'COULD_NOT_VERIFY' ? 'Last attempted' : 'Last verified'} {new Date(outcome.lastVerifiedAt).toLocaleString()}
        </p>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">No completed verification yet</p>
      )}
      <VerifyOutcomeButton siteId={home.site.siteId} outcomeId={outcome.id} disabled={outcome.running || !outcome.bindings.some((binding) => binding.required)} />
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Flags</h2>
        {relatedFlags.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No open Flag is tied to this Outcome.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {relatedFlags.map((flag) => (
              <li key={flag.id}>
                <Link href={`/sites/${home.site.siteId}/flags/${flag.id}`} className="text-sm underline">
                  {flag.problem}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      {outcome.pageUrls.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Pages</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {outcome.pageUrls.map((url) => <li key={url}>{url}</li>)}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
