import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Clock3,
  ExternalLink,
  Eye,
  Github,
  History,
  Radio,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { ProductWatchControls } from '@/components/audit/ProductWatchControls'
import { ProductSignalsSetup } from '@/components/dashboard/ProductSignalsSetup'
import { ImprovementReceipt } from '@/components/product/ImprovementReceipt'
import { ProductReviewAction } from '@/components/product/ProductReviewAction'
import { ProductAttentionImpression } from '@/components/product/ProductAttentionImpression'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
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
  const observation = activeManualReview ?? latestManualReview
  const attentionIsPrior = Boolean(
    activeManualReview &&
    latestCompletedManualReview &&
    activeManualReview.id !== latestCompletedManualReview.id,
  )

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
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {product.purpose ||
              'FixFlags will learn this Product’s purpose from its first Review.'}
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
      </header>

      <Surface variant="elevated">
        <ProductReviewAction
          productUrl={product.url}
          activeManualReview={activeManualReview}
          latestManualReview={latestManualReview}
          latestCompletedManualReview={latestCompletedManualReview}
        />
      </Surface>

      {observation ? (
        <Surface variant="nested" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">
                Latest observation
              </p>
              <p className="mt-1 text-sm font-medium">
                {reviewTypeLabel(observation)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="mt-1 text-sm font-medium">
                {presentProductReview(observation).label}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Score</p>
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
                {presentProductReview(observation).score}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {observation.completedAt ? 'Observed' : 'Started'}{' '}
            {dateLabel(observation.completedAt ?? observation.createdAt)}
            {observation.status === 'COMPLETED'
              ? ` · ${observation.unresolvedCount} unresolved`
              : ''}
          </p>
          {observation.status === 'FAILED' ? (
            <p
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {observation.failureMessage ||
                'This Product Review did not finish.'}
            </p>
          ) : null}
        </Surface>
      ) : null}

      {onAttentionVisible && workspace.attention.length > 0 ? (
        <ProductAttentionImpression onVisible={onAttentionVisible}>
          <AttentionSection
            workspace={workspace}
            attentionIsPrior={attentionIsPrior}
          />
        </ProductAttentionImpression>
      ) : (
        <AttentionSection
          workspace={workspace}
          attentionIsPrior={attentionIsPrior}
        />
      )}

      <section
        id="product-history"
        aria-labelledby="product-history-heading"
        className="space-y-3"
      >
        <div>
          <SectionTitle id="product-history-heading">
            Product history
          </SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Reviews, declared changes, independent verification, and proven
            learning in one record.
          </p>
        </div>
        <Surface variant="elevated">
          {workspace.history.events.length > 0 ? (
            <div className="divide-y divide-border/60">
              {workspace.history.events.map((event) => {
                if (event.kind === 'review') {
                  const reportView =
                    event.review.status === 'COMPLETED' ? 'report' : 'timeline'
                  return (
                    <Link
                      key={event.id}
                      href={
                        `/report/${event.review.id}?view=${reportView}` as Route
                      }
                      className="flex min-h-14 items-center justify-between gap-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">
                            {reviewTypeLabel(event.review)}
                          </span>
                          <Badge variant="outline">
                            {presentProductReview(event.review).label}
                          </Badge>
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
            <SectionTitle as="h2">Watch and Product context</SectionTitle>
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
            <Button asChild variant="outline">
              <Link href="/settings/integrations">
                <Github className="h-4 w-4" aria-hidden />
                Manage account-wide GitHub integration
              </Link>
            </Button>
          </div>
        </div>
      </details>
    </main>
  )
}

function AttentionSection({
  workspace,
  attentionIsPrior,
}: {
  workspace: ProductWorkspaceDTO
  attentionIsPrior: boolean
}) {
  const {
    activeManualReview,
    latestManualReview,
    latestCompletedManualReview,
  } = workspace
  return (
    <section aria-labelledby="attention-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <SectionTitle id="attention-heading">Attention now</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {attentionIsPrior
              ? 'From the latest completed Product Review while the current update review runs.'
              : 'Up to three worthwhile Improvements supported by the latest completed Review.'}
          </p>
        </div>
        <Badge variant="outline" className="font-mono tabular-nums">
          {workspace.attentionCount} open
        </Badge>
      </div>
      {workspace.attention.length === 0 ? (
        activeManualReview ? (
          <EmptyState
            icon={
              <Clock3 className="h-6 w-6 text-muted-foreground" aria-hidden />
            }
            title="Product Review in progress"
            description={
              latestCompletedManualReview
                ? 'The previous completed Review had no open Attention. New results will appear when this Review finishes.'
                : 'FixFlags is gathering the first evidence for this Product.'
            }
          />
        ) : latestManualReview?.status === 'FAILED' ? (
          <EmptyState
            icon={
              <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden />
            }
            title="The latest Product Review did not finish"
            description={
              latestCompletedManualReview
                ? 'There was no open Attention in the last completed Review. Try the update review again for current evidence.'
                : 'Try the Product Review again to establish current evidence.'
            }
          />
        ) : latestCompletedManualReview ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6 text-success" aria-hidden />}
            title="Nothing important requires action now"
            description="The latest completed Review found no open Attention."
          />
        ) : (
          <EmptyState
            icon={
              <History className="h-6 w-6 text-muted-foreground" aria-hidden />
            }
            title="No Review evidence yet"
            description="Run the first Product Review to understand what deserves attention."
          />
        )
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {workspace.attention.map((item, index) => (
            <Surface
              key={item.id}
              variant="nested"
              className="flex h-full flex-col gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">Priority {index + 1}</Badge>
                {item.severity ? (
                  <SeveritySignal severity={item.severity} />
                ) : null}
              </div>
              <div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.judgment}
                </p>
              </div>
              {item.evidence ? (
                <p className="border-l-2 border-brand-border pl-3 text-xs text-muted-foreground">
                  {item.evidence}
                </p>
              ) : null}
              <div className="mt-auto space-y-2 text-sm">
                <p>
                  <span className="font-medium">Improve:</span>{' '}
                  {item.recommendedChange}
                </p>
                <p>
                  <span className="font-medium">Verify:</span>{' '}
                  {item.successCondition}
                </p>
              </div>
              {item.sourceReviewId ? (
                <Button asChild variant="outline" className="w-full">
                  <Link
                    href={
                      (item.sourceFlagId
                        ? `/report/${item.sourceReviewId}?view=report&flag=${encodeURIComponent(item.sourceFlagId)}#report-flags`
                        : `/report/${item.sourceReviewId}?view=report`) as Route
                    }
                  >
                    Open source evidence
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </Surface>
          ))}
        </div>
      )}
    </section>
  )
}
