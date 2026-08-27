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
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import { ProductSignalsSetup } from '@/components/dashboard/ProductSignalsSetup'
import { ImprovementReceipt } from '@/components/product/ImprovementReceipt'
import { ProductReviewAction } from '@/components/product/ProductReviewAction'
import { ProductReviewTrend } from '@/components/product/ProductReviewTrend'
import { ProductAttentionImpression } from '@/components/product/ProductAttentionImpression'
import { ProductPriorities } from '@/components/product/ProductPriorities'
import { ProductIntelligenceTrack } from '@/components/product/ProductIntelligenceTrack'
import { ScoreRing } from '@/components/report/ScoreRing'
import { RubricScoreBar } from '@/components/report/RubricScoreBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { SectionTitle } from '@/components/ui/typography'
import { displayProductPurpose } from '@/lib/audit/product-contract'
import type { ProductWorkspaceDTO } from '@/lib/products/workspace'
import { serializeProductHistoryCursor } from '@/lib/products/workspace'
import { presentProductReview } from '@/lib/products/review-state'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { rubricLabel } from '@/lib/utils'
import { displayHostname } from '@/lib/utils/url-helpers'

function dateLabel(value: string | null): string {
  if (!value) return REPORT_COPY.workspace.product.notYet
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
  const currentReview =
    activeManualReview ?? latestCompletedManualReview ?? latestManualReview
  const progressEvents = workspace.history.events.filter(
    (event) => event.kind !== 'review'
  )
  const purpose = displayProductPurpose(product.purpose)
  const hostLabel = displayHostname(product.url) || product.url
  const copy = REPORT_COPY.workspace.product
  const dash = REPORT_COPY.workspace.dashboard
  const understanding = workspace.understanding
  const hasMemory =
    understanding.verifiedLearnings.length > 0 ||
    understanding.intentionalNotes.length > 0 ||
    understanding.knownRisks.length > 0 ||
    understanding.importantJourneys.length > 0 ||
    understanding.successConditions.length > 0 ||
    understanding.constraints.length > 0 ||
    understanding.decisions.length > 0 ||
    progressEvents.length > 0
  const showIntelligence = Boolean(understanding.productContract) || hasMemory
  const showRubricSummary =
    Boolean(latestCompletedManualReview) &&
    workspace.rubrics.some((rubric) => rubric.score != null)

  return (
    <main className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/dashboard">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            {copy.allProducts}
          </Link>
        </Button>
      </div>

      <header className="space-y-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-3xl font-semibold leading-tight tracking-display">
              {product.name}
            </h1>
            {product.watching ? (
              <Badge variant="outline" className="gap-1.5">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                {dash.watching}
              </Badge>
            ) : null}
          </div>
          <a
            href={product.url}
            target="_blank"
            rel="noreferrer"
            className="relative mt-0.5 inline-flex max-w-full items-center gap-1.5 text-sm text-link hover:text-link-hover after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']"
          >
            <span className="truncate">{hostLabel}</span>
            <ExternalLink className="relative h-3.5 w-3.5 shrink-0" aria-hidden />
          </a>
          {purpose ? (
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground text-pretty">
              {purpose}
            </p>
          ) : null}
        </div>
        {workspace.technologyProfile ? (
          <MadeWithProfile
            profile={workspace.technologyProfile}
            compact
            className="max-w-full"
          />
        ) : null}
      </header>

      <section aria-labelledby="current-review-heading">
        <Surface variant="elevated" className="space-y-5">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <ScoreRing
              score={currentReview?.score ?? null}
              pending={Boolean(activeManualReview)}
            />
            <div className="min-w-0 flex-1">
              <SectionTitle id="current-review-heading">
                {copy.currentReview}
              </SectionTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    currentReview
                      ? presentProductReview(currentReview).tone
                      : 'secondary'
                  }
                >
                  {currentReview
                    ? presentProductReview(currentReview).label
                    : copy.ready}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  {currentReview
                    ? copy.unresolvedLine(
                        currentReview.unresolvedCount,
                        dateLabel(currentReview.completedAt || currentReview.createdAt),
                        currentReview.coverageLabel,
                      )
                    : copy.reviewToFind}
                  {currentReview ? (
                    <>
                      {' · '}
                      <Link
                        href={`/report/${currentReview.id}?view=report` as Route}
                        className="relative text-link hover:text-link-hover after:absolute after:-inset-y-3 after:-inset-x-1 after:content-['']"
                      >
                        {dash.openReport}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <ProductReviewAction
                productUrl={product.url}
                activeManualReview={activeManualReview}
                latestManualReview={latestManualReview}
                latestCompletedManualReview={latestCompletedManualReview}
              />
            </div>
          </div>
          {showRubricSummary ? (
            <div
              className="grid gap-2 sm:grid-cols-3"
              aria-label="Message, Experience, and Reach scores"
            >
              {workspace.rubrics.map((rubric) => (
                <RubricScoreBar
                  key={rubric.name}
                  name={rubricLabel(rubric.name)}
                  score={rubric.score}
                  compact
                />
              ))}
            </div>
          ) : null}
          <ProductReviewTrend
            reviews={workspace.reviewHistory}
            embedded
          />
          {workspace.history.nextCursor ? (
            <div className="flex justify-end border-t border-border/50 pt-3">
              <Button asChild variant="ghost" className="w-full sm:w-auto">
                <Link
                  href={
                    (`/products/${product.id}?historyCursor=${encodeURIComponent(serializeProductHistoryCursor(workspace.history.nextCursor))}` +
                      '#current-review-heading') as Route
                  }
                >
                  {copy.olderReviews}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : null}
        </Surface>
      </section>
      {latestManualReview?.status === 'FAILED' ? (
        <p
          role="alert"
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {latestManualReview.failureMessage || copy.reviewFailedFallback}
        </p>
      ) : null}

      {onAttentionVisible && workspace.attention.length > 0 ? (
        <ProductAttentionImpression onVisible={onAttentionVisible}>
          <AttentionSection workspace={workspace} />
        </ProductAttentionImpression>
      ) : (
        <AttentionSection workspace={workspace} />
      )}

      {showIntelligence ? (
        <ProductIntelligenceSection
          workspace={workspace}
          progressEvents={progressEvents}
        />
      ) : null}

      <details className="group rounded-card border border-border/45 bg-card/60 shadow-card">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:px-5 [&::-webkit-details-marker]:hidden">
          <div>
            <SectionTitle as="h2">{copy.watchAndSignals}</SectionTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {product.watching ? copy.watchOn : copy.watchOff}
              {workspace.integrations.signalKeys.length > 0
                ? ` ${copy.signalKeysConnected(workspace.integrations.signalKeys.length)}`
                : ''}
            </p>
          </div>
          <ChevronDown
            className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>

        <div className="space-y-5 border-t border-border/45 p-4 sm:p-5">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
              <div>
                <SectionTitle as="h3">{copy.watch}</SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {product.watching
                    ? copy.watchOnSchedule(dateLabel(workspace.watch.lastRunAt))
                    : workspace.watch.eligible
                      ? copy.watchChooseSchedule
                      : copy.watchStudio}
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
                <span>{copy.watchNeedsAttention(workspace.watch.lastError)}</span>
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
                  {copy.latestWatchReview(
                    presentProductReview(latestWatchReview).label,
                  )}
                </p>
                <p className="mt-1">
                  {latestWatchReview.regressionCount === null
                    ? copy.changesEvaluating
                    : latestWatchReview.regressionCount > 0
                      ? copy.regressedIssues(latestWatchReview.regressionCount)
                      : copy.noRegressedIssues}
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
                  {copy.openWatchReview}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-border/45 pt-5">
            <div className="flex items-start gap-3">
              <Radio className="mt-0.5 h-5 w-5 text-brand" aria-hidden />
              <div>
                <SectionTitle as="h3">{copy.signals}</SectionTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {copy.signalsBody}
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
                      {copy.whatThisMeans}
                    </Badge>
                    {context.summary}
                  </p>
                ))}
              </div>
            ) : null}
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
                  ? copy.signalsNeedWatch
                  : copy.signalsNeedReview}
              </p>
            )}
          </div>
        </div>
      </details>
    </main>
  )
}

function ProductIntelligenceSection({
  workspace,
  progressEvents,
}: {
  workspace: ProductWorkspaceDTO
  progressEvents: ProductWorkspaceDTO['history']['events']
}) {
  const copy = REPORT_COPY.workspace.product
  const understanding = workspace.understanding
  const hasTimeline =
    progressEvents.length > 0 ||
    understanding.verifiedLearnings.length > 0 ||
    understanding.intentionalNotes.length > 0 ||
    understanding.knownRisks.length > 0
  const hasStructure =
    understanding.importantJourneys.length > 0 ||
    understanding.successConditions.length > 0 ||
    understanding.constraints.length > 0 ||
    understanding.decisions.length > 0

  return (
    <section className="space-y-5" aria-labelledby="product-intelligence-heading">
      <ProductIntelligenceTrack
        auditId={understanding.reviewId}
        learningCount={understanding.verifiedLearnings.length}
      />
      <SectionTitle id="product-intelligence-heading">
        {copy.understanding}
      </SectionTitle>
      {understanding.productContract ? (
        <div id="product-contract">
          <ProductContractCard
            contract={understanding.productContract}
            auditId={understanding.reviewId ?? undefined}
            canEdit
          />
        </div>
      ) : null}

      <div id="product-remember" className="space-y-3">
        <div>
          <h3 className="text-base font-semibold tracking-heading text-foreground">
            {copy.whatWeKnow}
          </h3>
          {!hasTimeline && !hasStructure ? (
            <p className="mt-1 text-sm text-muted-foreground">{copy.memoryGrows}</p>
          ) : null}
        </div>

        {hasTimeline || hasStructure ? (
          <Surface variant="elevated">
            <div className="divide-y divide-border/60">
              {progressEvents.map((event) => {
                if (event.kind === 'attempt') {
                  return (
                    <div key={event.id} className="space-y-2 py-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <p className="text-sm font-medium">
                          {copy.changeDeclared(event.improvementTitle)}
                        </p>
                        <span className="text-xs text-muted-foreground">
                          {dateLabel(event.at)}
                        </span>
                      </div>
                      <ImprovementReceipt attempt={event.attempt} />
                    </div>
                  )
                }
                if (event.kind === 'learning') {
                  return (
                    <div key={event.id} className="py-4">
                      <div className="rounded-nested-md bg-success-muted p-3">
                        <p className="text-xs font-medium uppercase tracking-label text-success">
                          {copy.verifiedLearning}
                        </p>
                        <p className="mt-1 text-sm">{event.learning.summary}</p>
                        <Link
                          href={
                            `/report/${event.learning.auditId}?view=report` as Route
                          }
                          className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-link"
                        >
                          {copy.evidenceFrom(dateLabel(event.learning.at))}
                        </Link>
                      </div>
                    </div>
                  )
                }
                return null
              })}

              {progressEvents.every((event) => event.kind !== 'learning') &&
              understanding.verifiedLearnings.length > 0
                ? understanding.verifiedLearnings.map((learning) => (
                    <div
                      key={`${learning.auditId}-${learning.at}-${learning.summary.slice(0, 24)}`}
                      className="py-4"
                    >
                      <div className="rounded-nested-md bg-success-muted p-3">
                        <p className="text-xs font-medium uppercase tracking-label text-success">
                          {copy.verifiedLearning}
                        </p>
                        <p className="mt-1 text-sm">{learning.summary}</p>
                        <Link
                          href={`/report/${learning.auditId}?view=report` as Route}
                          className="mt-2 inline-flex min-h-11 items-center text-xs font-medium text-link"
                        >
                          {copy.evidenceFrom(dateLabel(learning.at))}
                        </Link>
                      </div>
                    </div>
                  ))
                : null}

              {understanding.intentionalNotes.length > 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  {copy.intentionalLabel}:{' '}
                  {understanding.intentionalNotes.slice(0, 5).join(' · ')}
                </p>
              ) : null}
              {understanding.knownRisks.length > 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  {copy.acceptedRiskLabel}:{' '}
                  {understanding.knownRisks.slice(0, 5).join(' · ')}
                </p>
              ) : null}

              {understanding.importantJourneys.length > 0 ? (
                <MemoryList
                  label={copy.journeysLabel}
                  items={understanding.importantJourneys}
                />
              ) : null}
              {understanding.successConditions.length > 0 ? (
                <MemoryList
                  label={copy.successConditionsLabel}
                  items={understanding.successConditions}
                />
              ) : null}
              {understanding.constraints.length > 0 ? (
                <MemoryList
                  label={copy.constraintsLabel}
                  items={understanding.constraints}
                />
              ) : null}
              {understanding.decisions.length > 0 ? (
                <div className="space-y-2 py-4">
                  <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">
                    {copy.decisionsLabel}
                  </p>
                  <ul className="space-y-2">
                    {understanding.decisions.map((decision) => (
                      <li
                        key={`${decision.at}-${decision.text.slice(0, 24)}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                      >
                        <span>{decision.text}</span>
                        <span className="text-xs text-muted-foreground">
                          {dateLabel(decision.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </Surface>
        ) : null}
      </div>
    </section>
  )
}

function MemoryList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="space-y-2 py-4">
      <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">
        {label}
      </p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function AttentionSection({ workspace }: { workspace: ProductWorkspaceDTO }) {
  const copy = REPORT_COPY.workspace.product
  return (
    <section aria-labelledby="attention-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <SectionTitle id="attention-heading">{REPORT_COPY.explorer.prioritiesTitle}</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {copy.attentionHint}
          </p>
        </div>
        <Badge variant="outline" className="font-mono tabular-nums">
          {copy.attentionOpen(workspace.attentionCount)}
        </Badge>
      </div>
      <ProductPriorities
        items={workspace.attention}
        attentionEvidence={workspace.attentionEvidence}
        productUrl={workspace.product.url}
      />
    </section>
  )
}
