import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRight,
  CircleAlert,
  Eye,
  FileSearch,
  ShieldCheck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Surface } from '@/components/ui/surface'
import { SectionTitle } from '@/components/ui/typography'
import type { ProductOverviewDTO } from '@/lib/products/workspace'

function reviewDate(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function reviewState(review: ProductOverviewDTO['latestReview']) {
  if (!review) return { label: 'No review yet', tone: 'secondary' as const }
  if (review.status === 'FAILED') return { label: 'Review failed', tone: 'destructive' as const }
  if (review.status !== 'COMPLETED') return { label: 'Review in progress', tone: 'secondary' as const }
  if (review.reportCompleteness === 'PARTIAL') {
    return { label: 'Partial review', tone: 'outline' as const }
  }
  return { label: 'Review complete', tone: 'outline' as const }
}

export function ProductOverviewGrid({ products }: { products: ProductOverviewDTO[] }) {
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
            const state = reviewState(product.latestReview)
            return (
              <Surface
                key={product.id}
                variant="elevated"
                className="flex min-w-0 flex-col gap-5"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold tracking-heading">
                      {product.name}
                    </h2>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {product.purpose || product.url}
                    </p>
                  </div>
                  {product.watching ? (
                    <Badge variant="outline" className="shrink-0 gap-1.5">
                      <Eye className="h-3.5 w-3.5" aria-hidden />
                      Watching
                    </Badge>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-nested-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Attention</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                      {product.attentionCount}
                    </p>
                  </div>
                  <div className="rounded-nested-md bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Latest score</p>
                    <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">
                      {product.latestReview?.score ?? '-'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">Current review</span>
                    <Badge variant={state.tone}>{state.label}</Badge>
                  </div>
                  {product.latestReview ? (
                    <p className="text-xs text-muted-foreground">
                      Reviewed {reviewDate(product.latestReview.completedAt || product.latestReview.createdAt)}
                    </p>
                  ) : null}
                  {product.topAttention ? (
                    <div className="flex items-start gap-2 rounded-nested-md bg-brand-muted p-3">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground">Top priority</p>
                        <p className="mt-0.5 line-clamp-2 font-medium">
                          {product.topAttention.title}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-nested-md bg-success-muted p-3">
                      <ShieldCheck className="h-4 w-4 shrink-0 text-success" aria-hidden />
                      <p className="text-sm">No current Improvement needs attention.</p>
                    </div>
                  )}
                  {product.latestVerification ? (
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      Latest verification: {product.latestVerification.outcome.toLowerCase()} ·{' '}
                      {product.latestVerification.improvementTitle}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No independently verified Improvement yet.
                    </p>
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
