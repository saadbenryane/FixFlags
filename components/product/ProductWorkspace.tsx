import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Eye,
  Github,
  History,
  Radio,
  ShieldCheck,
} from 'lucide-react'
import { AuditInput } from '@/components/audit/AuditInput'
import { ProductSignalsSetup } from '@/components/dashboard/ProductSignalsSetup'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { SectionTitle } from '@/components/ui/typography'
import type {
  ProductAttemptDTO,
  ProductReviewSummaryDTO,
  ProductWorkspaceDTO,
} from '@/lib/products/workspace'

function dateLabel(value: string | null): string {
  if (!value) return 'Not yet'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function reviewLabel(review: ProductReviewSummaryDTO): string {
  if (review.status === 'FAILED') return 'Failed'
  if (review.status !== 'COMPLETED') return 'In progress'
  if (review.reportCompleteness === 'PARTIAL') return 'Partial'
  return review.isUpdateReview ? 'Update review' : 'Product review'
}

function attemptLabel(attempt: ProductAttemptDTO): string {
  if (!attempt.outcome) return 'Awaiting update review'
  return attempt.outcome.toLowerCase().replaceAll('_', ' ')
}

export function ProductWorkspace({ workspace }: { workspace: ProductWorkspaceDTO }) {
  const { product, currentReview, latestCompletedReview } = workspace

  return (
    <main className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            All Products
          </Link>
        </Button>
      </div>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-3xl font-semibold tracking-display">{product.name}</h1>
            {product.watching ? (
              <Badge variant="outline" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Watching
              </Badge>
            ) : null}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {product.purpose || 'FixFlags will learn this Product’s purpose from its first Review.'}
          </p>
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex min-h-11 max-w-full items-center gap-1.5 text-sm text-link hover:text-link-hover"
          >
            <span className="truncate">{product.url}</span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
        </div>
        {latestCompletedReview ? (
          <Button asChild variant="outline">
            <Link href={`/report/${latestCompletedReview.id}` as Route}>
              Open current Review
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : null}
      </header>

      <Surface variant="elevated" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionTitle>Review this Product</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {latestCompletedReview
                ? 'Run a fresh update review after deploying a change.'
                : 'Start the first Product Review to establish evidence and Attention.'}
            </p>
          </div>
          {currentReview && currentReview.status !== 'COMPLETED' && currentReview.status !== 'FAILED' ? (
            <Badge variant="secondary" className="gap-1.5">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              Review in progress
            </Badge>
          ) : null}
        </div>
        <AuditInput initialUrl={product.url} idSuffix="-product-workspace" />
        {(currentReview || latestCompletedReview) ? (
          <div className="grid gap-3 rounded-nested-md bg-muted/35 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Current observation</p>
              <p className="mt-1 text-sm font-medium">
                {reviewLabel(currentReview || latestCompletedReview!)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">
                {(currentReview || latestCompletedReview!)?.score ?? '-'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Observed</p>
              <p className="mt-1 text-sm font-medium">
                {dateLabel((currentReview || latestCompletedReview!)?.completedAt || (currentReview || latestCompletedReview!)?.createdAt)}
              </p>
            </div>
          </div>
        ) : null}
      </Surface>

      <section aria-labelledby="attention-heading" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <SectionTitle id="attention-heading">Attention now</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Up to three worthwhile Improvements supported by current evidence.
            </p>
          </div>
          <Badge variant="outline" className="font-mono tabular-nums">
            {workspace.attentionCount} open
          </Badge>
        </div>
        {workspace.attention.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6 text-success" aria-hidden />}
            title={latestCompletedReview ? 'Nothing important requires action now' : 'No Review evidence yet'}
            description={
              latestCompletedReview
                ? 'The complete Review remains available. FixFlags will look again on the next update review.'
                : 'Run the first Review to understand what deserves attention.'
            }
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {workspace.attention.map((item, index) => (
              <Surface key={item.id} variant="nested" className="flex h-full flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">Priority {index + 1}</Badge>
                  {item.severity ? <span className="text-xs text-muted-foreground">{item.severity}</span> : null}
                </div>
                <div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.judgment}</p>
                </div>
                {item.evidence ? (
                  <p className="border-l-2 border-brand-border pl-3 text-xs text-muted-foreground">
                    {item.evidence}
                  </p>
                ) : null}
                <div className="mt-auto space-y-2 text-sm">
                  <p><span className="font-medium">Improve:</span> {item.recommendedChange}</p>
                  <p><span className="font-medium">Verify:</span> {item.successCondition}</p>
                </div>
                {item.latestAttempt ? (
                  <Badge variant="secondary" className="w-fit">
                    {attemptLabel(item.latestAttempt)}
                  </Badge>
                ) : null}
                {latestCompletedReview ? (
                  <Button asChild variant="outline" className="w-full">
                    <Link href={`/report/${latestCompletedReview.id}#report-top-fixes` as Route}>
                      Open Improvement
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                ) : null}
              </Surface>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="improvement-history-heading" className="space-y-3">
        <div>
          <SectionTitle id="improvement-history-heading">Improve and remember</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow each declared change through independent verification, then retain only proven learning.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Surface variant="elevated" className="space-y-4">
          <div>
            <SectionTitle>Improvement history</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">Attempts and independent verification receipts.</p>
          </div>
          {workspace.improvementHistory.some((improvement) => improvement.attempts.length > 0) ? (
            <div className="space-y-3">
              {workspace.improvementHistory
                .filter((improvement) => improvement.attempts.length > 0)
                .slice(0, 8)
                .map((improvement) => {
                  const attempt = improvement.attempts[0]
                  return (
                    <div key={improvement.id} className="rounded-nested-md bg-muted/35 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-sm font-medium">{improvement.title}</p>
                        <Badge variant="outline">{attemptLabel(attempt)}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {attempt.changeSummary || 'A builder marked this Improvement ready to verify.'}
                      </p>
                      {attempt.verificationReason ? (
                        <p className="mt-2 text-xs text-muted-foreground">{attempt.verificationReason}</p>
                      ) : null}
                      {attempt.verificationReviewId ? (
                        <Link
                          href={`/report/${attempt.verificationReviewId}` as Route}
                          className="mt-2 inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-link"
                        >
                          Open verification Review
                          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      ) : null}
                    </div>
                  )
                })}
            </div>
          ) : (
            <EmptyState
              icon={<History className="h-6 w-6" aria-hidden />}
              title="No attempts yet"
              description="Copy a fix from the Review, make the change, then mark it ready for an update review."
              className="py-8"
            />
          )}
          </Surface>

          <Surface variant="elevated" className="space-y-4">
          <div>
            <SectionTitle>Remember</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">Only independently verified Product learnings appear here.</p>
          </div>
          {workspace.memory.verifiedLearnings.length > 0 ? (
            <ul className="space-y-3">
              {workspace.memory.verifiedLearnings.slice(0, 8).map((learning) => (
                <li key={`${learning.auditId}:${learning.at}`} className="rounded-nested-md bg-success-muted p-3">
                  <p className="text-sm">{learning.summary}</p>
                  <Link
                    href={`/report/${learning.auditId}` as Route}
                    className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-link"
                  >
                    Evidence from {dateLabel(learning.at)}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" aria-hidden />}
              title="No verified learnings yet"
              description="FixFlags remembers an outcome only after a fresh comparable update review proves it."
              className="py-8"
            />
          )}
        </Surface>
      </div>

      <Surface variant="elevated" className="space-y-4">
        <div>
          <SectionTitle>Review history</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">Every observation of this Product, newest first.</p>
        </div>
        {workspace.reviewHistory.length > 0 ? (
          <div className="divide-y divide-border/60">
            {workspace.reviewHistory.map((review) => (
              <Link
                key={review.id}
                href={`/report/${review.id}` as Route}
                className="flex min-h-14 items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{reviewLabel(review)}</span>
                    {review.reportCompleteness === 'PARTIAL' ? <Badge variant="outline">Partial evidence</Badge> : null}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateLabel(review.completedAt || review.createdAt)} · {review.unresolvedCount} unresolved
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-lg font-semibold tabular-nums">{review.score ?? '-'}</span>
                  <ArrowRight className="h-4 w-4 text-brand" aria-hidden />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No Reviews yet" description="Start the first Product Review above." className="py-8" />
        )}
      </Surface>

      </section>

      <section aria-labelledby="watch-integrations-heading" className="space-y-3">
        <div>
          <SectionTitle id="watch-integrations-heading">Watch and integrations</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep ongoing observation separate from independent Review verification.
          </p>
        </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Surface variant="elevated" className="space-y-4">
          <div className="flex items-start gap-3">
            <Eye className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
            <div>
              <SectionTitle>Watch</SectionTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {product.watching
                  ? `Watching for meaningful changes. Last checked ${dateLabel(product.watchLastRunAt)}.`
                  : 'Turn on Watch from a completed Review to check this Product on its schedule.'}
              </p>
            </div>
          </div>
          {product.watchLastError ? (
            <div role="alert" className="flex items-start gap-2 rounded-nested-md bg-destructive/10 p-3 text-sm text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>Watch needs attention: {product.watchLastError}</span>
            </div>
          ) : null}
          {latestCompletedReview ? (
            <Button asChild variant="outline">
              <Link href={`/report/${latestCompletedReview.id}#report-recheck` as Route}>Manage Watch</Link>
            </Button>
          ) : null}
        </Surface>

        <Surface variant="elevated" className="space-y-4">
          <div className="flex items-start gap-3">
            <Radio className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
            <div>
              <SectionTitle>Product context</SectionTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Privacy-bounded browser Signals are observations. They add context but never verify a fix.
              </p>
            </div>
          </div>
          {workspace.integrations.observedContext.length > 0 ? (
            <div className="space-y-2">
              {workspace.integrations.observedContext.map((context) => (
                <p key={`${context.kind}:${context.summary}`} className="rounded-nested-md bg-muted/35 p-3 text-sm text-muted-foreground">
                  <Badge variant="outline" className="mr-2">Observed</Badge>
                  {context.summary}
                </p>
              ))}
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            {workspace.integrations.activeSignalKeyCount > 0
              ? `${workspace.integrations.activeSignalKeyCount} active key${workspace.integrations.activeSignalKeyCount === 1 ? '' : 's'} · Last signal ${dateLabel(workspace.integrations.lastSignalAt)}`
              : 'No browser Signal key installed.'}
          </p>
          {workspace.integrations.signalsEligible && latestCompletedReview ? (
            <ProductSignalsSetup productId={product.id} productUrl={product.url} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {latestCompletedReview
                ? 'Product Signals are available with Product Watch access.'
                : 'Run a Product Review before adding browser context.'}
            </p>
          )}
            <Button asChild variant="outline">
              <Link href="/settings/integrations">
                <Github className="h-4 w-4" aria-hidden />
                Manage GitHub integration
              </Link>
            </Button>
          </Surface>
        </div>
      </section>
    </main>
  )
}
