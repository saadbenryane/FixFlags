import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, CircleAlert, Eye, FileSearch, Flag } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { SectionTitle } from '@/components/ui/typography'
import type { ProductOverviewDTO } from '@/lib/products/workspace'
import { presentProductReview } from '@/lib/products/review-state'

function reviewDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
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
          description="Review a URL below. FixFlags will keep that Product and every future update review together."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {products.map((product) => {
            const state = presentProductReview(product.latestManualReview)
            return (
              <Surface
                key={product.id}
                variant="elevated"
                className="flex min-w-0 flex-col gap-5"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-lg font-semibold tracking-heading">
                      {product.name}
                    </h3>
                    {product.purpose ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {product.purpose}
                      </p>
                    ) : null}
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {product.url}
                    </p>
                  </div>
                  {product.watching ? (
                    <Badge variant="outline" className="shrink-0 gap-1.5">
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Watching
                    </Badge>
                  ) : null}
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-nested-md bg-muted/30 p-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Latest Review
                      </p>
                      <Badge variant={state.tone} className="mt-1.5">
                        {state.label}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Score</p>
                      <p className="mt-1 font-mono text-base font-semibold tabular-nums">
                        {state.score}
                      </p>
                    </div>
                  </div>
                  {product.latestManualReview ? (
                    <p className="text-xs text-muted-foreground">
                      {product.latestManualReview.completedAt
                        ? 'Reviewed'
                        : 'Started'}{' '}
                      {reviewDate(
                        product.latestManualReview.completedAt ||
                          product.latestManualReview.createdAt,
                      )}
                    </p>
                  ) : null}
                  {product.topAttention ? (
                    <div className="flex items-start gap-2 rounded-nested-md bg-brand-muted p-3">
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
                          {product.attentionCount} open{' '}
                          {product.attentionCount === 1
                            ? 'Improvement'
                            : 'Improvements'}
                        </p>
                        <p className="mt-0.5 line-clamp-2 font-medium">
                          {product.topAttention.title}
                        </p>
                        {product.topAttention.severity ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {product.topAttention.severity.toLowerCase()}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-nested-md border border-border/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        Attention
                      </p>
                      <p className="mt-1 text-sm">
                        {!product.latestManualReview
                          ? 'No Review evidence yet.'
                          : product.latestManualReview.status === 'FAILED'
                            ? 'The latest Review did not finish.'
                            : product.latestManualReview.status !== 'COMPLETED'
                              ? 'Review in progress. New Attention will appear when it finishes.'
                              : '0 open Improvements in the latest completed Review.'}
                      </p>
                    </div>
                  )}
                </div>

                <Button asChild className="mt-auto w-full sm:w-fit">
                  <Link href={`/products/${product.id}` as Route}>
                    Open Product
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              </Surface>
            )
          })}
        </div>
      )}
    </section>
  )
}
