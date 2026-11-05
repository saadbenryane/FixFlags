'use client'

import { SiteBoard } from '@/components/sites/SiteBoard'
import type { SiteHomeView } from '@/lib/sites/site-home'

/** Development entry reuses the product workspace after the design was accepted. */
export function PageReviewPreview({ siteId, initial }: { siteId: string; initial: SiteHomeView }) {
  return <SiteBoard siteId={siteId} initial={initial} viewMode="pages" />
}
