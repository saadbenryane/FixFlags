import { prisma } from '@/lib/db'
import { auditFullInclude } from '@/lib/audit/fetch-audit'
import { sanitizeRubricForRead } from '@/lib/audit/sanitize-prompts'
import { buildLiveExplorerModel } from '@/lib/report/explorer-model'
import {
  buildReportWorkspaceModel,
  historyPointFromAudit,
  type ReportWorkspaceModel,
} from '@/lib/report/workspace-model'

export interface ObservationSnapshot {
  workspace: ReportWorkspaceModel
  url: string
  pageType: string | null
  screenshots: unknown[]
}

/**
 * Load one observation (a completed audit in the owner's release chain) as a
 * full workspace model so the Product Spine can re-anchor the workspace to
 * that moment in the product's history.
 *
 * Owner-only by design: the caller has already verified `audit.userId` matches
 * the session user. Fix prompts are returned in full because the owner sees
 * them on their own report; no stripping is needed.
 */
export async function loadObservationSnapshot(
  userId: string,
  observationId: string
): Promise<ObservationSnapshot | null> {
  const audit = await prisma.audit.findUnique({
    where: { id: observationId },
    include: auditFullInclude,
  })
  if (!audit) return null
  if (audit.userId !== userId) return null

  const rubricRows = audit.rubrics.map((rubric) => {
    const sanitized = sanitizeRubricForRead(rubric)
    return {
      name: sanitized.name,
      grade: sanitized.grade,
      score: sanitized.score,
    }
  })

  const flags = audit.flags
  const screenshots = audit.screenshots

  const explorer = buildLiveExplorerModel({
    url: audit.url,
    pageType: audit.pageType,
    score: audit.score,
    verdict: audit.verdict,
    flags,
    screenshots,
    rubricRows,
    promptAccess: 'all',
  })

  const checkedAt = audit.completedAt ?? audit.createdAt
  const workspace = buildReportWorkspaceModel({
    kind: 'completed',
    explorer,
    auditId: audit.id,
    url: audit.url,
    pageType: audit.pageType,
    checkedAt,
    status: 'completed',
    history: [
      historyPointFromAudit({
        id: audit.id,
        score: audit.score,
        checkedAt,
        parentId: audit.parentId,
        recheckTrigger: audit.recheckTrigger,
      }),
    ],
    checkedScope: audit.pages.length > 1 ? `${audit.pages.length} pages` : 'the submitted page',
    promptAccess: 'all',
  })

  return {
    workspace,
    url: audit.url,
    pageType: audit.pageType,
    screenshots,
  }
}
