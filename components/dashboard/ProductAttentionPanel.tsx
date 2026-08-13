import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, CheckCircle2, Eye, History, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Surface } from '@/components/ui/surface'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { ProductSignalsSetup } from '@/components/dashboard/ProductSignalsSetup'

type AttentionImprovement = {
  id: string
  title: string
  judgment: string
  recommendedChange: string
  successCondition: string
  status: string
  attempts: Array<{ id: string; outcome: string | null }>
  occurrences: Array<{ flag: { evidence: string } }>
}

type AttentionProduct = {
  id: string
  name: string
  url: string
  purpose: string | null
  watching: boolean
  latestReviewId: string | null
  attention: AttentionImprovement[]
  verifiedCount: number
  signalContext: Array<{ summary: string; truthClass: 'OBSERVED' }>
  history: Array<{
    id: string
    title: string
    status: string
    attempts: Array<{ id: string; outcome: string | null }>
  }>
}

export function ProductAttentionPanel({ product }: { product: AttentionProduct }) {
  const copy = REPORT_COPY.workspace.dashboard
  return (
    <section aria-labelledby="attention-heading" className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{product.name}</p>
          <p className="truncate text-xs text-muted-foreground">{product.purpose || product.url}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {product.watching ? (
            <Badge variant="outline" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Watching
            </Badge>
          ) : product.latestReviewId ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/report/${product.latestReviewId}` as Route}>{copy.keepWatching}</Link>
            </Button>
          ) : null}
          {product.verifiedCount > 0 ? (
            <Badge variant="outline" className="gap-1.5">
              <History className="h-3.5 w-3.5" aria-hidden />
              {product.verifiedCount} verified
            </Badge>
          ) : null}
        </div>
      </div>

      <div>
        <h2 id="attention-heading" className="flex items-center gap-2 text-base font-semibold">
          <Sparkles className="h-4 w-4" aria-hidden />
          {copy.attentionTitle}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{copy.attentionBody}</p>
      </div>

      {product.attention.length === 0 ? (
        <Surface variant="nested" className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" aria-hidden />
          <div>
            <p className="text-sm font-medium">{copy.noAttention}</p>
            <p className="mt-1 text-sm text-muted-foreground">{copy.noAttentionBody}</p>
          </div>
        </Surface>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          {product.attention.map((improvement, index) => (
            <Surface key={improvement.id} variant="nested" className="flex h-full flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <Badge variant="outline">Priority {index + 1}</Badge>
                <span className="text-xs text-muted-foreground">
                  {improvement.status.replaceAll('_', ' ').toLowerCase()}
                </span>
              </div>
              <div>
                <h3 className="text-sm font-semibold">{improvement.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{improvement.judgment}</p>
              </div>
              {improvement.occurrences[0]?.flag.evidence ? (
                <p className="border-l-2 border-border pl-3 text-xs text-muted-foreground">
                  {improvement.occurrences[0].flag.evidence}
                </p>
              ) : null}
              <div className="mt-auto space-y-2 text-xs">
                <p><span className="font-medium">Improve:</span> {improvement.recommendedChange}</p>
                <p><span className="font-medium">Verify:</span> {improvement.successCondition}</p>
              </div>
              {product.latestReviewId ? (
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link href={`/report/${product.latestReviewId}` as Route}>
                    Open Product
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </Button>
              ) : null}
            </Surface>
          ))}
        </div>
      )}

      {product.signalContext.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">
            {copy.observedContext}
          </p>
          {product.signalContext.map((context) => (
            <p key={context.summary} className="text-sm text-muted-foreground">
              <Badge variant="outline" className="mr-2">{context.truthClass}</Badge>
              {context.summary}
            </p>
          ))}
        </div>
      ) : null}

      {product.history.some((improvement) => improvement.attempts.length > 0) ? (
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-xs font-medium uppercase tracking-label text-muted-foreground">
            {copy.historyTitle}
          </p>
          {product.history
            .filter((improvement) => improvement.attempts.length > 0)
            .slice(0, 5)
            .map((improvement) => (
              <div key={improvement.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{improvement.title}</span>
                <Badge variant="outline">
                  {improvement.attempts[0]?.outcome || improvement.status.replaceAll('_', ' ')}
                </Badge>
              </div>
            ))}
        </div>
      ) : null}

      {product.latestReviewId ? (
        <div className="border-t border-border/60 pt-4">
          <ProductSignalsSetup productId={product.id} productUrl={product.url} />
        </div>
      ) : null}
    </section>
  )
}
