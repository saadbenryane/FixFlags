'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Globe2 } from 'lucide-react'
import { BoardCard } from '@/components/sites/BoardCard'
import type { ProductOverviewDTO } from '@/lib/products/workspace'
import { REPORT_COPY } from '@/lib/marketing/copy'
import styles from '@/components/sites/BoardCard.module.css'

export function ProductOverviewGrid({ products }: { products: ProductOverviewDTO[] }) {
  const copy = REPORT_COPY.workspace.dashboard
  return <section aria-labelledby="products-heading" className={styles.surface}>
    <div className={styles.surfaceHeader}>
      <h2 id="products-heading" className="sr-only">{copy.productsHeading}</h2>
      <span className="text-xs text-muted-foreground">{copy.productCount(products.length)}</span>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {products.map(product => {
        const review = product.latestManualReview
        const completed = review?.status === 'COMPLETED'
        const checking = Boolean(review && !completed && review.status !== 'FAILED')
        const answer = checking ? 'Checking your website' : review?.status === 'FAILED' ? 'Could not complete the check' : product.topAttention?.title ?? (completed ? review?.reportCompleteness === 'FULL' ? 'No open Flags' : 'Coverage is incomplete' : 'Ready for a first check')
        return <BoardCard key={product.id}
          name={product.name}
          state={checking ? 'checking' : product.attentionCount ? 'attention' : 'unknown'}
          status={checking ? 'Checking' : completed ? review?.reportCompleteness === 'FULL' ? 'Checked' : 'Partial check' : 'Not checked yet'}
          answer={answer}
          detail={product.purpose}
          flagCount={product.attentionCount}
          footer={product.watching ? copy.watching : null}
          href={`/sites/${product.id}` as Route}
          icon={Globe2}
        />
      })}
      <Link href={'/new' as Route} aria-label="Check a website URL" className={styles.addCard}>
        <Globe2 size={22} aria-hidden="true" />
        <strong>{products.length ? 'Add a website' : 'Check your first website'}</strong>
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">Start with a URL <ArrowRight size={16} aria-hidden="true" /></span>
      </Link>
    </div>
  </section>
}
