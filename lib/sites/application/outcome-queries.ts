import { prisma } from '@/lib/db'
import type { SiteRecord } from '@/lib/sites/types'
import { projectOutcomeDetail, type SiteOutcomeDetailView } from '@/lib/sites/presentation/outcome-detail-view'
import { projectOutcomeView, type OutcomeViewSource, type SiteOutcomeView } from '@/lib/sites/presentation/outcome-view'
import type { CurrentBindingRevision } from '@/lib/sites/domain/assessment-comparability'
import { loadOutcomeBindingRevisions } from './outcome-binding-revisions'
import { loadOutcomeDetailReferences, loadOutcomeSummaryReferences } from './outcome-references'

export const outcomePageProjection = { include: { page: { select: { url: true, projectId: true, provisionalSiteId: true } } } } as const
export const outcomeRunRequestSelect = { id: true, status: true, requestedAt: true, errorMessage: true, auditId: true } as const

type OutcomeProjectionSource = Omit<OutcomeViewSource, 'pages' | 'projectId'> & {
  projectId: string | null
  provisionalSiteId: string | null
  pages: Array<{ pageId: string; page: { url: string; projectId: string | null; provisionalSiteId: string | null } }>
}

export async function toOutcomeView(row: OutcomeProjectionSource, bindingRevisions?: CurrentBindingRevision[], now = new Date()): Promise<SiteOutcomeView> {
  const revisions = bindingRevisions ?? (row.assessments[0] ? (await loadOutcomeBindingRevisions([row]))[0] : [])
  // Associations must retain the Outcome's current owner. In particular, an
  // old provisional association cannot borrow a page after that page is claimed.
  const pages = row.pages.filter(({ page }) => row.projectId ? page.projectId === row.projectId
    : Boolean(row.provisionalSiteId && !page.projectId && page.provisionalSiteId === row.provisionalSiteId))
  return projectOutcomeView({ ...row, pages }, { bindingRevisions: revisions, pageUrls: pages.map(({ page }) => page.url), now })
}

export async function listSiteOutcomes(site: SiteRecord, now = new Date()): Promise<SiteOutcomeView[]> {
  const ownerFilter =
    site.kind === 'project'
      ? { projectId: site.projectId! }
      : { provisionalSiteId: site.provisionalSiteId! }

  const references = await loadOutcomeSummaryReferences(site)
  if (!references.length) return []
  const rows = await prisma.siteOutcome.findMany({
    where: { ...ownerFilter, id: { in: references.map(row => row.id) } },
    include: {
      pages: outcomePageProjection,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true, config: true } },
      assessments: { where: { id: { in: references.flatMap(row => row.assessmentIds) } }, orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }] },
      runSelections: { where: { OR: references.map(row => ({ outcomeId: row.id, runRequestId: { in: row.runRequestIds } })) },
        select: { runRequest: { select: outcomeRunRequestSelect } }, orderBy: { runRequest: { requestedAt: 'desc' } } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const revisions = await loadOutcomeBindingRevisions(rows)
  return Promise.all(rows.map((row, index) => toOutcomeView(row, revisions[index], now)))
}

export type { SiteOutcomeDetailView } from '@/lib/sites/presentation/outcome-detail-view'

export async function loadSiteOutcomeDetail(
  site: SiteRecord,
  outcomeId: string,
): Promise<SiteOutcomeDetailView | null> {
  return (await loadSiteOutcomeDetails(site, { outcomeId }))[0] ?? null
}

/** Read bounded evidence per Outcome, with one batch for each shared authority. */
export async function loadSiteOutcomeDetails(site: SiteRecord,
  options: { outcomeId?: string; excludeGeneric?: boolean } = {}): Promise<SiteOutcomeDetailView[]> {
  const ownerFilter = site.kind === 'project'
    ? { projectId: site.projectId! }
    : { provisionalSiteId: site.provisionalSiteId! }
  const references = await loadOutcomeDetailReferences(site, options)
  if (!references.length) return []
  const ids = (key: 'assessmentIds' | 'bindingAttemptIds' | 'executionIds' | 'improvementIds' | 'occurrenceIds' | 'improvementAttemptIds') => references.flatMap(row => row[key])
  const assessmentIds = [...new Set([...ids('assessmentIds'), ...references.flatMap(row => row.successfulAssessmentId ? [row.successfulAssessmentId] : [])])]
  const byId = new Map(references.map(row => [row.id, row]))
  const rows = await prisma.siteOutcome.findMany({
    where: { ...ownerFilter, id: { in: references.map(row => row.id) } },
    include: {
      pages: outcomePageProjection,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true, config: true } },
      assessments: { where: { id: { in: assessmentIds } }, orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }] },
      runSelections: { where: { OR: references.map(row => ({ outcomeId: row.id, runRequestId: { in: row.runRequestIds } })) },
        select: { runRequest: { select: outcomeRunRequestSelect } }, orderBy: { runRequest: { requestedAt: 'desc' } } },
      bindingAttempts: { where: { id: { in: ids('bindingAttemptIds') } }, orderBy: { createdAt: 'desc' } },
      bindingExecutions: { where: { id: { in: ids('executionIds') } }, orderBy: { createdAt: 'desc' }, include: { audit: { select: { executionSpec: true } } } },
      improvements: {
        where: { id: { in: ids('improvementIds') }, projectId: { in: site.projectId ? [site.projectId] : [] } },
        select: {
          id: true, title: true,
          occurrences: { where: { id: { in: ids('occurrenceIds') } }, orderBy: { createdAt: 'desc' }, select: { id: true, kind: true, createdAt: true, auditId: true } },
          attempts: { where: { id: { in: ids('improvementAttemptIds') } }, orderBy: { createdAt: 'desc' }, select: {
            id: true, createdAt: true, changeSummary: true, outcome: true, verificationReason: true, sourceAuditId: true, verificationAuditId: true,
          } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })
  if (!rows.length) return []
  const revisions = await loadOutcomeBindingRevisions(rows)
  const now = new Date()
  const recent = rows.map(row => ({ ...row, assessments: row.assessments.filter(assessment => byId.get(row.id)!.assessmentIds.includes(assessment.id)) }))
  const views = await Promise.all(recent.map((row, index) => toOutcomeView(row, revisions[index], now)))
  return recent.map((row, index) => {
    const successful = rows[index].assessments.find(assessment => assessment.id === byId.get(row.id)!.successfulAssessmentId)
    const evidence = successful?.evidence
    const superseded = evidence && typeof evidence === 'object' && !Array.isArray(evidence) ? evidence.supersededByAssessmentId : null
    // Selection is not a certificate if a late writer superseded it before hydration.
    const lastSuccessful = successful?.state === 'CLEAR' && superseded == null ? successful : null
    return projectOutcomeDetail({ row, view: views[index], revisions: revisions[index],
      executions: row.bindingExecutions, lastSuccessful, improvements: row.improvements }, now)
  })
}
