import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, CircleAlert, Eye, FileSearch, Flag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { TextLink } from '@/components/ui/text-link'
import { Surface } from '@/components/ui/surface'
import { SectionTitle } from '@/components/ui/typography'
import { ProductCaptureThumb } from '@/components/dashboard/ProductCaptureThumb'
import { ProductScoreSparkline } from '@/components/dashboard/ProductScoreSparkline'
import type { ProductOverviewDTO } from '@/lib/products/workspace'
import { presentProductReview } from '@/lib/products/review-state'
import { displayHostname } from '@/lib/utils/url-helpers'

function reviewDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function productLinkLabel(product: ProductOverviewDTO): string {
  const state = presentProductReview(product.latestManualReview)
  const first = product.scoreHistory[0]?.score
  const last = product.scoreHistory.at(-1)?.score
  const trend =
    product.scoreHistory.length > 1 && first != null && last != null
      ? ` Score trend ${Math.round(first)} to ${Math.round(last)}.`
      : ` Latest score ${state.score}.`
  const attention = product.topAttention
    ? ` ${product.attentionCount} open. ${product.topAttention.title}.`
    : ''
  return `Open Product ${product.name}.${trend}${attention}`
}

export function ProductOverviewGrid({
  products,
}: {
  products: ProductOverviewDTO[]
}) {
  return (
    <section aria-labelledby="products-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <SectionTitle id="products-heading">Your Products</SectionTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a Product to see what deserves attention and what changed.
          </p>
        </div>
        <Badge variant="outline" className="font-mono tabular-nums">
          {products.length} {products.length === 1 ? 'Product' : 'Products'}
        </Badge>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<FileSearch className="h-6 w-6" aria-hidden />}
          title="No Products yet"
          description="Review a URL above. FixFlags will keep that Product and every future update review together."
          action={
            <TextLink href={'/help/getting-started/first-check' as Route}>
              Run your first product review
            </TextLink>
          }
        />
      ) : (
        <Surface variant="elevated" className="overflow-hidden p-0">
          <div className="divide-y divide-border/60">
            {products.map((product) => {
              const state = presentProductReview(product.latestManualReview)
              const reviewAt = product.latestManualReview
                ? product.latestManualReview.completedAt ||
                  product.latestManualReview.createdAt
                : null
              return (
                <Link
                  key={product.id}
                  href={`/products/${product.id}` as Route}
                  aria-label={productLinkLabel(product)}
                  className="group grid min-h-28 grid-cols-[7.5rem_minmax(0,1fr)] gap-4 px-4 py-4 transition-colors hover:bg-muted/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring sm:grid-cols-[7.5rem_minmax(0,1.1fr)_11rem_minmax(0,1fr)_auto] sm:items-center sm:px-5"
                >
                  <ProductCaptureThumb src={product.desktopScreenshotUrl} />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold tracking-heading">
                        {product.name}
                      </h3>
                      {product.watching ? (
                        <Badge variant="outline" className="shrink-0 gap-1.5">
                          <Eye className="h-3.5 w-3.5" aria-hidden />
                          Watching
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {displayHostname(product.url) || product.url}
                    </p>
                    {product.purpose ? (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                        {product.purpose}
                      </p>
                    ) : null}
                  </div>

                  <div className="col-span-2 min-w-0 sm:col-span-1 sm:border-l sm:border-border/50 sm:pl-4">
                    <p className="text-xs text-muted-foreground">
                      Latest Review
                    </p>
                    <ProductScoreSparkline
                      productId={product.id}
                      points={product.scoreHistory}
                      decorative
                      className="mt-1.5"
                    />
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <span className="font-mono text-lg font-semibold tabular-nums">
                        {state.score}
                      </span>
                      {reviewAt ? (
                        <span className="text-xs text-muted-foreground">
                          {reviewDate(reviewAt)}
                        </span>
                      ) : null}
                    </div>
                    <Badge variant={state.tone} className="mt-1.5">
                      {state.label}
                    </Badge>
                  </div>

                  <div className="col-span-2 flex min-w-0 items-start gap-2 sm:col-span-1 sm:border-l sm:border-border/50 sm:pl-4">
                    {product.topAttention ? (
                      <>
                        {product.topAttention.severity === 'CRITICAL' ? (
                          <CircleAlert
                            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
                            aria-hidden
                          />
                        ) : (
                          <Flag
                            className="mt-0.5 h-4 w-4 shrink-0 text-brand"
                            aria-hidden
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-muted-foreground">
                            {product.attentionCount} open
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-sm font-medium">
                            {product.topAttention.title}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">
                          Attention
                        </p>
                        <p className="mt-0.5 text-sm">
                          {!product.latestManualReview
                            ? 'No Review evidence yet.'
                            : product.latestManualReview.status === 'FAILED'
                              ? 'The latest Review did not finish.'
                              : product.latestManualReview.status !==
                                  'COMPLETED'
                                ? 'Review in progress. New Attention will appear when it finishes.'
                                : '0 open Improvements in the latest completed Review.'}
                        </p>
                      </div>
                    )}
                  </div>

                  <ArrowRight
                    className="hidden h-5 w-5 text-brand transition-transform group-hover:translate-x-0.5 sm:block"
                    aria-hidden
                  />
                </Link>
              )
            })}
          </div>
        </Surface>
      )}
    </section>
  )
}
