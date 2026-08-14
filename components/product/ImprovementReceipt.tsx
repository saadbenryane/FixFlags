import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, CircleX, Clock3, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { ProductAttemptDTO } from '@/lib/products/workspace'

type Coverage = {
  completeReview?: boolean
  evidenceComparable?: boolean
  relevantPageCovered?: boolean
  verifierExecuted?: boolean
  verifierStatus?: string
  failedModules?: string[]
  pageUrl?: string | null
}

type EvidenceReference = {
  beforeAuditId?: string
  beforeFlagId?: string
  afterAuditId?: string
  afterFlagId?: string | null
}

function objectValue<T>(value: unknown): T | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as T : null
}

function outcomeLabel(attempt: ProductAttemptDTO): string {
  if (!attempt.outcome) return 'Awaiting update Review'
  return attempt.outcome.charAt(0) + attempt.outcome.slice(1).toLowerCase()
}

function OutcomeIcon({ attempt }: { attempt: ProductAttemptDTO }) {
  if (!attempt.outcome) return <Clock3 className="h-4 w-4 text-muted-foreground" aria-hidden />
  if (attempt.outcome === 'IMPROVED') {
    return <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
  }
  return <CircleX className="h-4 w-4 text-destructive" aria-hidden />
}

export function ImprovementReceipt({
  attempt,
}: {
  attempt: ProductAttemptDTO
}) {
  const coverage = objectValue<Coverage>(attempt.verificationCoverage)
  const evidence = objectValue<EvidenceReference>(attempt.evidenceReference)
  const sourceReviewId = evidence?.beforeAuditId ?? attempt.sourceReviewId
  const sourceFlagId = evidence?.beforeFlagId ?? attempt.sourceFlagId
  const verificationReviewId = evidence?.afterAuditId ?? attempt.verificationReviewId
  const sourceHref = sourceFlagId
    ? `/report/${sourceReviewId}?flag=${encodeURIComponent(sourceFlagId)}#report-flags`
    : `/report/${sourceReviewId}`

  return (
    <article className="rounded-nested-md bg-muted/35 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <OutcomeIcon attempt={attempt} />
          <p className="text-sm font-semibold">{outcomeLabel(attempt)}</p>
        </div>
        <Badge variant={attempt.outcome === 'IMPROVED' ? 'outline' : 'secondary'}>
          {attempt.builder}
        </Badge>
      </div>

      <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-medium text-foreground">Declared change</dt>
          <dd className="mt-1 text-muted-foreground">
            {attempt.changeSummary || 'A builder marked this Improvement ready to verify.'}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">Deployment reference</dt>
          <dd className="mt-1 break-all text-muted-foreground">
            {attempt.deploymentReference || 'Not provided'}
          </dd>
        </div>
        {attempt.testedCondition ? (
          <div className="sm:col-span-2">
            <dt className="font-medium text-foreground">Condition tested</dt>
            <dd className="mt-1 text-muted-foreground">{attempt.testedCondition}</dd>
          </div>
        ) : null}
      </dl>

      {attempt.outcome ? (
        <div className="mt-3 space-y-2 rounded-nested-sm bg-background/70 p-3 text-xs">
          <p className="font-medium text-foreground">Independent verification</p>
          <p className="text-muted-foreground">
            {attempt.verificationReason || 'The update Review recorded a verification outcome.'}
          </p>
          {coverage ? (
            <ul className="grid gap-1 text-muted-foreground sm:grid-cols-2">
              <li>Review complete: {coverage.completeReview ? 'Yes' : 'No'}</li>
              <li>Comparable evidence: {coverage.evidenceComparable ? 'Yes' : 'No'}</li>
              <li>Affected page covered: {coverage.relevantPageCovered ? 'Yes' : 'No'}</li>
              <li>Verifier completed: {coverage.verifierExecuted ? 'Yes' : 'No'}</li>
              {coverage.verifierStatus ? <li>Verifier status: {coverage.verifierStatus.toLowerCase()}</li> : null}
              {coverage.pageUrl ? <li className="truncate">Scope: {coverage.pageUrl}</li> : null}
            </ul>
          ) : null}
          {coverage?.failedModules?.length ? (
            <p className="text-destructive">Unavailable evidence: {coverage.failedModules.join(', ')}</p>
          ) : null}
          {attempt.remainingRisk ? (
            <p className="text-muted-foreground"><span className="font-medium text-foreground">Remaining risk:</span> {attempt.remainingRisk}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Run a fresh update Review after the change is live. The builder declaration is not verification.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={sourceHref as Route}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-link hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Open source evidence
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
        {verificationReviewId ? (
          <Link
            href={`/report/${verificationReviewId}` as Route}
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-link hover:text-link-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open verification Review
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>
    </article>
  )
}
