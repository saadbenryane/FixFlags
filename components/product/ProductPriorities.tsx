'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import type { Route } from 'next'
import { ReportExplorer } from '@/components/report/ReportExplorer'
import { Button } from '@/components/ui/button'
import { buildAttentionExplorerModel } from '@/lib/products/attention-explorer'
import type {
  ProductAttentionEvidenceDTO,
  ProductAttentionItemDTO,
} from '@/lib/products/workspace'
import { SHARE_COPY } from '@/lib/marketing/copy'

export function ProductPriorities({
  items,
  attentionEvidence = {},
}: {
  items: ProductAttentionItemDTO[]
  attentionEvidence?: Record<string, ProductAttentionEvidenceDTO>
}) {
  const model = useMemo(
    () => buildAttentionExplorerModel(items, attentionEvidence),
    [items, attentionEvidence]
  )

  const itemByFlagId = useMemo(() => {
    const map = new Map<string, ProductAttentionItemDTO>()
    for (const item of items) {
      map.set(item.sourceFlagId ?? item.id, item)
    }
    return map
  }, [items])

  if (model.flags.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No open priorities. Run an Update review whenever the Product changes.
      </p>
    )
  }

  return (
    <div className="@container/pane">
      <ReportExplorer
        model={model}
        hideListHeading
        resolveOwnerActionContext={(flagId) => {
          const item = itemByFlagId.get(flagId)
          if (!item?.sourceReviewId) return undefined
          return {
            auditId: item.sourceReviewId,
            surface: 'product',
            accessState: 'owner',
          }
        }}
        secondaryPromptAction={(flagId) => {
          const item = itemByFlagId.get(flagId)
          if (!item?.sourceReviewId) return null
          const href =
            `/report/${item.sourceReviewId}?view=report&flag=${encodeURIComponent(flagId)}` as Route
          return (
            <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
              <Link href={href}>{SHARE_COPY.access.viewReport}</Link>
            </Button>
          )
        }}
      />
    </div>
  )
}
