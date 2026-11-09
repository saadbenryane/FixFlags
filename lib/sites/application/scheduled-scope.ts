import type { Prisma } from '@prisma/client'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { INTERNAL_REVIEW_PAGE_CEILING } from '@/lib/audit/review-depth'
import { interruptedAnalysisWorkWhere, unavailableBrowserPageWhere } from '@/lib/audit/progressive/recorded-completeness'
import type { WatchInterval } from '../watch-schedule'
import { siteCareIntervalMinutes } from '../evidence-freshness'
import { analysisEnvironmentWhere, siteWideAnalysisAuditWhere } from './analysis-scope'
import { readExecutionSpec, type ExecutionSpec } from '../domain/execution-spec'
import { recordedPageUrls, recordedPublicResponseCoversPage, requiredPublicResponseChecks } from '../page-coverage'
import { monitoringResponsibility } from './monitoring-responsibility'

const SCHEDULER_TOLERANCE_MS = 60_000
type ScheduledEvidenceReader = Pick<Prisma.TransactionClient, 'audit' | 'auditVerificationReceipt' | '$queryRaw'>

async function hasScheduledPublicResponses(db: ScheduledEvidenceReader, auditId: string, spec: ExecutionSpec, pages: string[]) {
  const checks = requiredPublicResponseChecks(spec)
  if (!checks.length) return true
  const pending = new Set(pages)
  let after: string | undefined
  while (pending.size) {
    // The page limit bounds one read. Retained receipts can share a page, so
    // an unreadable receipt cannot consume the remaining page's evidence slot.
    const receipts = await db.auditVerificationReceipt.findMany({
      where: { auditId, targetKey: 'module:page-response', status: 'COMPLETED', pageUrl: { in: [...pending] },
        ...(after ? { id: { gt: after } } : {}) },
      orderBy: { id: 'asc' }, take: INTERNAL_REVIEW_PAGE_CEILING,
      select: { id: true, targetKey: true, status: true, pageUrl: true, taskId: true, detail: true },
    })
    for (const receipt of receipts) {
      if (receipt.pageUrl && pending.has(receipt.pageUrl) && recordedPublicResponseCoversPage(auditId, checks, receipt))
        pending.delete(receipt.pageUrl)
    }
    if (receipts.length < INTERNAL_REVIEW_PAGE_CEILING) break
    after = receipts.at(-1)!.id
  }
  return pending.size === 0
}

export function scheduledOutcomesWhere(projectId: string): Prisma.SiteOutcomeWhereInput {
  return { projectId, enabled: true, environment: 'production', bindings: { some: { enabled: true, required: true } } }
}

/** Reusing broad evidence retains its original renewal clock. Both admission
 * and schedule advancement use this boundary, including its existing tolerance. */
export async function loadFreshScheduledBroadSource(db: ScheduledEvidenceReader, input: {
  projectId: string; targetUrl: string; targetRevision?: number; interval: WatchInterval; everyMinutes?: number | null; now: Date;
}) {
  const target = normalizeAuditNavigationUrl(input.targetUrl)
  const lifetime = siteCareIntervalMinutes(input.interval, input.everyMinutes) * 60_000 - SCHEDULER_TOLERANCE_MS
  const source = await db.audit.findFirst({ where: { projectId: input.projectId, status: { in: ['COMPLETED', 'FAILED'] },
    ...siteWideAnalysisAuditWhere,
    AND: [analysisEnvironmentWhere('production')],
    ...((input.targetRevision ?? 1) > 1 ? { runRequests: { some: { projectId: input.projectId,
      context: { path: ['watchTargetRevision'], equals: input.targetRevision } } } } : {}),
    createdAt: { gt: new Date(input.now.getTime() - lifetime), lte: input.now },
  }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, url: true, executionSpec: true, createdAt: true, completedAt: true, status: true,
    pages: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: INTERNAL_REVIEW_PAGE_CEILING, select: { url: true, status: true, failureCode: true } },
    verifierExecutions: { where: interruptedAnalysisWorkWhere, select: { id: true }, take: 1 },
  } })
  // Select the Site's latest broad attempt before deciding whether it can be
  // reused. An older matching URL cannot conceal a failed branch of that Site.
  if (source?.status !== 'COMPLETED' || !source.completedAt || source.completedAt > input.now || source.verifierExecutions.length ||
    source.pages.some(page => page.failureCode === unavailableBrowserPageWhere.failureCode)) return null
  const entry = target.ok ? target.url : input.targetUrl
  const spec = readExecutionSpec(source.executionSpec)
  const compatible = spec?.scope === 'SITE' && spec.targetUrl === source.url && spec.environment === 'production'
  if (!compatible && source.executionSpec && typeof source.executionSpec === 'object' &&
    'engine' in source.executionSpec && source.executionSpec.engine === 'progressive-v1') return null
  const recorded = [source.url, ...recordedPageUrls({ executionSpec: compatible ? spec : null, pages: source.pages })]
  // Admitted pages describe work owed. Only settled page observations can
  // defer that work, including when no collector ever opened a page row.
  const covered = new Set(source.pages.filter(page => page.status === 'COMPLETED').map(page => page.url))
  // Sharing a Site does not make another path, query, port or fragment fresh.
  if (!covered.has(entry)) return null
  // Admission and freshness must agree about retained responsibilities, including
  // older analyses claimed after this source completed. None can disappear merely
  // because a more recent branch happened to finish successfully.
  const required = await monitoringResponsibility({ projectId: input.projectId, environment: 'production', targetUrl: entry, recorded }, db)
  if (!required.every(url => covered.has(url)) || compatible && !await hasScheduledPublicResponses(db, source.id, spec, required)) return null
  return { id: source.id, renewAt: new Date(source.createdAt.getTime() + lifetime) }
}
