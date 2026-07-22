import type { ReactNode } from 'react'
import type { RecheckDiffSummary } from '@/components/audit/RecheckDiffStrip'
import type { RubricComputed } from '@/lib/audit/rubric'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { ProductContract } from '@/lib/audit/product-contract'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { buildFinishPlan, type FinishPlan } from '@/lib/audit/finish-plan'

export interface ReportViewModel {
  summary: {
    auditId: string
    url: string
    pageType: string | null
    verdict: string | null
    score: number | null
    shareStatus: string
    screenshots: AuditScreenshot[]
    rubrics: RubricComputed[]
    rubricRows: Array<{
      name: string
      grade: string | null
      score: number | null
      status?: string | null
      summary?: string
      flags: RankableFlag[]
    }>
  }
  finishPlan: FinishPlan
  details: { href: string; flagCount: number }
  access: {
    isLoggedIn: boolean
    isOwner: boolean
    isAnonymous: boolean
    promptAccess: 'all' | 'one' | 'none'
    signUpHref: string
  }
  recheck: {
    diff: RecheckDiffSummary | null
    compareHref: string | null
    canRecheck: boolean
    parentId: string | null
  }
  actions: { toolbar: ReactNode | null }
}

export function assembleReportViewModel(input: {
  auditId: string
  audit: {
    url: string
    pageType: string | null
    verdict: string | null
    score: number | null
    shareStatus: string
    screenshots?: AuditScreenshot[]
    rubrics: RubricComputed[]
    rubricRows: ReportViewModel['summary']['rubricRows']
    flags: RankableFlag[]
    productContract?: ProductContract | null
    parentId?: string | null
  }
  isLoggedIn: boolean
  isOwner: boolean
  isAnonymous: boolean
  showPrompts: boolean
  demonstratedFlag?: RankableFlag | null
  recheckDiff?: RecheckDiffSummary | null
  compareHref?: string | null
  toolbarActions?: ReactNode
  detailsHref?: string
}): ReportViewModel {
  const promptAccess = input.showPrompts ? 'all' : input.demonstratedFlag ? 'one' : 'none'
  return {
    summary: {
      auditId: input.auditId,
      url: input.audit.url,
      pageType: input.audit.pageType,
      verdict: input.audit.verdict,
      score: input.audit.score,
      shareStatus: input.audit.shareStatus,
      screenshots: input.audit.screenshots ?? [],
      rubrics: input.audit.rubrics,
      rubricRows: input.audit.rubricRows,
    },
    finishPlan: buildFinishPlan({
      flags: input.audit.flags,
      rubricRows: input.audit.rubricRows,
      url: input.audit.url,
      contract: input.audit.productContract ?? null,
      promptAccess,
      demonstratedFlag: input.demonstratedFlag,
    }),
    details: {
      href: input.detailsHref ?? `/report/${input.auditId}/details`,
      flagCount: input.audit.flags.length,
    },
    access: {
      isLoggedIn: input.isLoggedIn,
      isOwner: input.isOwner,
      isAnonymous: input.isAnonymous,
      promptAccess,
      signUpHref: `/sign-up?next=/report/${input.auditId}&from=report`,
    },
    recheck: {
      diff: input.recheckDiff ?? null,
      compareHref: input.compareHref ?? null,
      canRecheck: input.isLoggedIn && input.isOwner,
      parentId: input.audit.parentId ?? null,
    },
    actions: { toolbar: input.toolbarActions ?? null },
  }
}
