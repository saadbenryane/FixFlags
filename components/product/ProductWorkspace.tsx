import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Eye,
  Radio,
  TriangleAlert,
} from 'lucide-react'
import { ProductWatchControls } from '@/components/audit/ProductWatchControls'
import { ProductSignalsSetup } from '@/components/dashboard/ProductSignalsSetup'
import { ImprovementReceipt } from '@/components/product/ImprovementReceipt'
import { ProductReviewAction } from '@/components/product/ProductReviewAction'
import { ProductAttentionImpression } from '@/components/product/ProductAttentionImpression'
import { ProductPriorities } from '@/components/product/ProductPriorities'
import { ScoreRing } from '@/components/report/ScoreRing'
import { ScoreHistoryChart } from '@/components/report/ScoreHistoryChart'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { SectionTitle } from '@/components/ui/typography'
import type {
  ProductReviewSummaryDTO,
  ProductWorkspaceDTO,
} from '@/lib/products/workspace'
import { serializeProductHistoryCursor } from '@/lib/products/workspace'
import { presentProductReview } from '@/lib/products/review-state'

function dateLabel(value: string | null): string {
  if (!value) return 'Not yet'
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function reviewTypeLabel(review: ProductReviewSummaryDTO): string {
  if (review.kind === 'WATCH') return 'Watch review'
  return review.kind === 'UPDATE_REVIEW' ? 'Update review' : 'Product review'
}

export function ProductWorkspace({
  workspace,
  onAttentionVisible,
}: {
  workspace: ProductWorkspaceDTO
  onAttentionVisible?: () => Promise<void>
}) {
  const {
    product,
    activeManualReview,
    latestManualReview,
    latestCompletedManualReview,
    latestWatchReview,
  } = workspace
  const currentReview = activeManualReview ?? latestCompletedManualReview ?? latestManualReview
  const reviewHistory = workspace.history.events
    .filter((event) => event.kind === 'review')
    .map((event) => ({
      id: event.review.id,
      href: `/report/${event.review.id}?view=report`,
      score: event.review.score,
      checkedAt: new Date(event.at),
      kind: event.review.kind === 'WATCH' ? 'watch' as const : event.review.kind === 'UPDATE_REVIEW' ? 'update-review' as const : 'product-review' as const,
      status: event.review.status === 'FAILED' ? 'failed' as const : event.review.reportCompleteness === 'PARTIAL' ? 'partial' as const : 'completed' as const,
    }))
    .reverse()

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
            <h1 className="truncate text-3xl font-semibold tracking-display">
              {product.name}
            </h1>
            {product.watching ? (
              <Badge variant="outline" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                Watching
              </Badge>
            ) : null}
          </div>
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
      </header>

      <section className="flex flex-wrap items-center gap-5 border-y border-border/45 py-5" aria-label="Current score and review history">
        <ScoreRing score={currentReview?.score ?? null} pending={Boolean(activeManualReview)} />
        <ScoreHistoryChart history={reviewHistory} currentAuditId={currentReview?.id} isLoading={Boolean(activeManualReview)} className="min-w-[14rem] flex-1" />
        <ProductReviewAction productUrl={product.url} activeManualReview={activeManualReview} latestManualReview={latestManualReview} latestCompletedManualReview={latestCompletedManualReview} />
      </section>
      {latestManualReview?.status === 'FAILED' ? <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{latestManualReview.failureMessage || 'The latest review did not finish. Start an Update review to try again.'}</p> : null}

      {onAttentionVisible && workspace.attention.length > 0 ? (
        <ProductAttentionImpression onVisible={onAttentionVisible}>
          <AttentionSection
            workspace={workspace}
          />
        </ProductAttentionImpression>
      ) : (
        <AttentionSection
          workspace={workspace}
        />
      )}

      <section
        id="product-history"
        aria-labelledby="product-history-heading"
        className="space-y-3"
      >
        <div>
          <SectionTitle id="product-history-heading">
            Recent activity
          </SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Reviews, copied prompts, verification, and learning.
          </p>
        </div>
        <Surface variant="elevated">
          {workspace.history.events.length > 0 ? (
            <div className="divide-y divide-border/60">
              {workspace.history.events.map((event) => {
                if (event.kind === 'review') {
                  return (
                    <Link
                      key={event.id}
                      href={
                        `/report/${event.review.id}?view=report` as Route
                      }
                      className="flex min-h-14 items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {reviewTypeLabel(event.review)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {dateLabel(event.at)}
                          {event.review.status === 'COMPLETED'
                            ? ` · ${event.review.unresolvedCount} unresolved`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {presentProductReview(event.review).score}
                        </span>
                        <ArrowRight
                          className="h-4 w-4 text-brand"
                          aria-hidden
                        />
                      </div>
                    </Link>
                  )
                }

                if (event.kind === 'attempt') {
                  return (
                    <div key={event.id} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">
                          Change declared: {event.improvementTitle}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {dateLabel(event.at)}
                        </span>
                      </div>
                      <ImprovementReceipt attempt={event.attempt} />
                    </div>
                  )
                }

                return (
                  <div key={event.id} className="py-4">
                    <div className="rounded-nested-md bg-success-muted p-3">
                      <p className="text-xs font-medium uppercase tracking-label text-success">
                        Verified learning
                      </p>
                      <p className="mt-1 text-sm">{event.learning.summary}</p>
                      <Link
                        href={
                          `/report/${event.learning.auditId}?view=report` as Route
                        }
                        className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-link"
                      >
                        Evidence from {dateLabel(event.learning.at)}
                      </Link>
                    </div>
                  </div>
                )
              })}
              {workspace.history.nextCursor ? (
                <div className="py-3">
                  <Button asChild variant="ghost" className="w-full sm:w-auto">
                    <Link
                      href={
                        (`/products/${product.id}?historyCursor=${encodeURIComponent(serializeProductHistoryCursor(workspace.history.nextCursor))}` +
                          '#product-history') as Route
                      }
                    >
                      Older history
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="py-4 text-sm text-muted-foreground">
              Product history begins with the first completed Review.
            </p>
          )}
        </Surface>
      </section>

      <details className="group rounded-card border border-border/45 bg-card/60 shadow-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-5 [&::-webkit-details-marker]:hidden">
          <div>
            <SectionTitle as="h2">Product context</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.watching ? 'Watch is active.' : 'Watch is not active.'}{' '}
              {workspace.integrations.signalKeys.length > 0
                ? `${workspace.integrations.signalKeys.length} Signal key${workspace.integrations.signalKeys.length === 1 ? '' : 's'} connected.`
                : 'No browser Signal key connected.'}
            </p>
          </div>
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="grid gap-4 border-t border-border/45 p-4 sm:p-5 lg:grid-cols-2">
          <p className="text-sm text-muted-foreground lg:col-span-2">{product.purpose || 'FixFlags will learn this Product’s purpose from its first review.'}</p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
              <div>
                <SectionTitle as="h3">Watch</SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.watching
                    ? `Watching for meaningful changes. Last checked ${dateLabel(workspace.watch.lastRunAt)}.`
                    : 'Choose a schedule after the first completed Review.'}
                </p>
              </div>
            </div>
            {workspace.watch.lastError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-nested-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                <TriangleAlert
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden
                />
                <span>Watch needs attention: {workspace.watch.lastError}</span>
              </div>
            ) : null}
            {latestCompletedManualReview ? (
              <ProductWatchControls
                projectId={product.id}
                canWatch={workspace.watch.eligible}
                canDaily={workspace.watch.canDaily}
                initialInterval={workspace.watch.interval}
                initialState={{
                  watchInterval: workspace.watch.interval,
                  watchNextRunAt: workspace.watch.nextRunAt,
                  watchLastRunAt: workspace.watch.lastRunAt,
                  watchLastAttemptAt: workspace.watch.lastAttemptAt,
                  watchConsecutiveFailures: workspace.watch.consecutiveFailures,
                  watchLastError: workspace.watch.lastError,
                }}
              />
            ) : null}
            {latestWatchReview ? (
              <div className="rounded-nested-md bg-muted/35 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  Latest Watch Review:{' '}
                  {presentProductReview(latestWatchReview).label}
                </p>
                <p className="mt-1">
                  {latestWatchReview.regressionCount === null
                    ? 'Meaningful changes are still being evaluated.'
                    : latestWatchReview.regressionCount > 0
                      ? `${latestWatchReview.regressionCount} new or regressed issue${latestWatchReview.regressionCount === 1 ? '' : 's'} found.`
                      : 'No new or regressed issues found.'}
                </p>
                <p className="mt-1">
                  Notification:{' '}
                  {latestWatchReview.notificationStatus
                    .toLowerCase()
                    .replaceAll('_', ' ')}
                  {latestWatchReview.notificationAttempts > 0
                    ? ` · ${latestWatchReview.notificationAttempts} attempt${latestWatchReview.notificationAttempts === 1 ? '' : 's'}`
                    : ''}
                </p>
                {latestWatchReview.notificationError ? (
                  <p role="alert" className="mt-1 text-destructive">
                    {latestWatchReview.notificationError}
                  </p>
                ) : null}
                <Link
                  href={`/report/${latestWatchReview.id}?view=report` as Route}
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 font-medium text-link"
                >
                  Open Watch Review
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Radio className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
              <div>
                <SectionTitle as="h3">Product context</SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Privacy-bounded browser Signals add context but never verify a
                  fix.
                </p>
              </div>
            </div>
            {workspace.integrations.observedContext.length > 0 ? (
              <div className="space-y-2">
                {workspace.integrations.observedContext.map((context) => (
                  <p
                    key={`${context.kind}:${context.summary}`}
                    className="rounded-nested-md bg-muted/35 p-3 text-sm text-muted-foreground"
                  >
                    <Badge variant="outline" className="mr-2">
                      Observed
                    </Badge>
                    {context.summary}
                  </p>
                ))}
              </div>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {workspace.integrations.signalKeys.length > 0
                ? `${workspace.integrations.signalKeys.length} active key${workspace.integrations.signalKeys.length === 1 ? '' : 's'} · Last accepted Signal ${dateLabel(workspace.integrations.lastSignalAt)}`
                : 'No browser Signal key installed.'}
            </p>
            {workspace.integrations.signalsEligible &&
            latestCompletedManualReview ? (
              <ProductSignalsSetup
                productId={product.id}
                productUrl={product.url}
                initialKeys={workspace.integrations.signalKeys}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {latestCompletedManualReview
                  ? 'Product Signals are available with Product Watch access.'
                  : 'Run a Product Review before adding browser context.'}
              </p>
            )}
          </div>
        </div>
      </details>
    </main>
  )
}

function AttentionSection({
  workspace,
}: {
  workspace: ProductWorkspaceDTO
}) {
  return (
    <section aria-labelledby="attention-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <SectionTitle id="attention-heading">Your priorities</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranked by the effect each issue has on the customer experience.
          </p>
        </div>
        <Badge variant="outline" className="font-mono tabular-nums">
          {workspace.attentionCount} open
        </Badge>
      </div>
      <ProductPriorities items={workspace.attention} />
    </section>
  )
}
