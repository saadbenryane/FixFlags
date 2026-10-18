import { prisma } from '@/lib/db'
import { Prisma } from '@prisma/client'
import type { SiteRecord } from '@/lib/sites/types'
import { projectOutcomeDetail, type SiteOutcomeDetailView } from '@/lib/sites/presentation/outcome-detail-view'
import { projectOutcomeView, type OutcomeViewSource, type SiteOutcomeView } from '@/lib/sites/presentation/outcome-view'
import type { CurrentBindingRevision } from '@/lib/sites/domain/assessment-comparability'
import { loadOutcomeBindingRevisions } from './outcome-binding-revisions'

async function pageUrlsForIds(pageIds: string[]): Promise<string[]> {
  if (pageIds.length === 0) return []
  const pages = await prisma.sitePage.findMany({
    where: { id: { in: pageIds } },
    select: { id: true, url: true },
  })
  const byId = new Map(pages.map((p) => [p.id, p.url]))
  return pageIds.map((id) => byId.get(id)).filter((url): url is string => Boolean(url))
}

export async function toOutcomeView(row: OutcomeViewSource, bindingRevisions?: CurrentBindingRevision[]): Promise<SiteOutcomeView> {
  const revisions = bindingRevisions ?? (row.assessments[0] ? (await loadOutcomeBindingRevisions([row]))[0] : [])
  const pageUrls = await pageUrlsForIds(row.pages.map(page => page.pageId))
  return projectOutcomeView(row, { bindingRevisions: revisions, pageUrls, now: new Date() })
}

export async function listSiteOutcomes(site: SiteRecord): Promise<SiteOutcomeView[]> {
  const ownerFilter =
    site.kind === 'project'
      ? { projectId: site.projectId! }
      : { provisionalSiteId: site.provisionalSiteId! }

  const rows = await prisma.siteOutcome.findMany({
    where: ownerFilter,
    include: {
      pages: true,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true, config: true } },
      assessments: { orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }], take: 1 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 1 },
    },
    orderBy: { createdAt: 'asc' },
  })

  const revisions = await loadOutcomeBindingRevisions(rows)
  return Promise.all(rows.map((row, index) => toOutcomeView(row, revisions[index])))
}

export type { SiteOutcomeDetailView } from '@/lib/sites/presentation/outcome-detail-view'

export async function loadSiteOutcomeDetail(
  site: SiteRecord,
  outcomeId: string,
): Promise<SiteOutcomeDetailView | null> {
  const ownerFilter = site.kind === 'project'
    ? { projectId: site.projectId! }
    : { provisionalSiteId: site.provisionalSiteId! }
  const row = await prisma.siteOutcome.findFirst({
    where: { id: outcomeId, ...ownerFilter },
    include: {
      pages: true,
      bindings: { where: { enabled: true }, select: { key: true, required: true, scope: true, mechanism: true, version: true, config: true } },
      assessments: { orderBy: [{ runRequest: { requestedAt: 'desc' } }, { assessedAt: 'desc' }], take: 20 },
      runSelections: { include: { runRequest: true }, orderBy: { runRequest: { requestedAt: 'desc' } }, take: 20 },
      bindingAttempts: { orderBy: { createdAt: 'desc' }, take: 20 },
    },
  })
  if (!row) return null
  const [revisions] = await loadOutcomeBindingRevisions([row])
  const view = await toOutcomeView(row, revisions)
  const [executions, lastSuccessful, improvements] = await Promise.all([
    prisma.outcomeBindingExecution.findMany({
      where: { outcomeId: row.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { audit: { select: { executionSpec: true } } },
    }),
    prisma.outcomeAssessment.findFirst({
      // Same predicate as the incident writer. A rejected late clear stays
      // stored and is not a successful verification for this Outcome.
      where: {
        outcomeId: row.id,
        state: 'CLEAR',
        evidence: { path: ['supersededByAssessmentId'], equals: Prisma.AnyNull },
      },
      orderBy: { assessedAt: 'desc' },
      select: { assessedAt: true },
    }),
    site.projectId ? prisma.improvement.findMany({
      where: { projectId: site.projectId, outcomeId: row.id },
      select: {
        id: true,
        title: true,
        occurrences: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { id: true, kind: true, createdAt: true, auditId: true },
        },
        attempts: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true,
            createdAt: true,
            changeSummary: true,
            outcome: true,
            verificationReason: true,
            sourceAuditId: true,
            verificationAuditId: true,
          },
        },
      },
    }) : Promise.resolve([]),
  ])
  return projectOutcomeDetail({ row, view, revisions, executions, lastSuccessful, improvements }, new Date())
}
