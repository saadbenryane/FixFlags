import type { AuditAccessContext } from '@/lib/audit/access-capabilities'
import type { FixList } from '@/lib/audit/finish-plan'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import type { ProductContract } from '@/lib/audit/product-contract'

/**
 * Render-ready completed Report projection. Not a public HTTP contract.
 * UI components must not infer entitlement or verification from leftover audit fields.
 */
export type ReportWorkspaceAuditDTO = {
  accessContext: Exclude<AuditAccessContext, 'denied'> | 'repository_sample'
  pageType: string | null
  score: number | null
  url: string
  screenshots?: AuditScreenshot[]
  rubricRows: Array<{
    id: string
    name: string
    grade: string | null
    score: number | null
    status: string | null
    summary: string
    flags: RankableFlag[]
  }>
  flags: RankableFlag[]
  reportCompleteness?: 'FULL' | 'PARTIAL' | 'UNKNOWN'
  reviewCoverage?: unknown
  completedAt?: string | Date | null
  parentId?: string | null
  previewMeta?: PreviewMeta | null
  evidenceAnchors?: EvidenceAnchorMap
  flagVisualEvidence?: import('@/lib/audit/persist-visual-evidence').FlagVisualEvidenceMap
  productContract?: ProductContract | null
  failedModules?: string[]
  fixList?: FixList
}

export type ReportWorkspaceDTO =
  | { kind: 'forbidden' }
  | {
      kind: 'progressive'
      id: string
      audit: Record<string, unknown> & { accessContext: AuditAccessContext }
      session: unknown
      atAuditLimit?: boolean
    }
  | {
      kind: 'completed'
      id: string
      reportAudit: ReportWorkspaceAuditDTO
    }
