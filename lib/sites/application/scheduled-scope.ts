import type { Prisma } from '@prisma/client'
import { normalizeAuditNavigationUrl } from '@/lib/audit/url'
import { INTERNAL_REVIEW_PAGE_CEILING } from '@/lib/audit/review-depth'
import { interruptedAnalysisWorkWhere } from '@/lib/audit/progressive/recorded-completeness'
import type { WatchInterval } from '../watch-schedule'
import { siteCareIntervalMinutes } from '../evidence-freshness'
import { analysisEnvironmentWhere, siteWideAnalysisAuditWhere } from './analysis-scope'
import { readExecutionSpec } from '../domain/execution-spec'
import { recordedPageUrls } from '../page-coverage'
import { monitoringResponsibility } from './monitoring-responsibility'

const SCHEDULER_TOLERANCE_MS = 60_000

export function scheduledOutcomesWhere(projectId: string): Prisma.SiteOutcomeWhereInput {
  return { projectId, enabled: true, environment: 'production', bindings: { some: { enabled: true, required: true } } }
}

/** Reusing broad evidence retains its original renewal clock. Both admission
 * and schedule advancement use this boundary, including its existing tolerance. */
export async function loadFreshScheduledBroadSource(db: Pick<Prisma.TransactionClient, 'audit' | '$queryRaw'>, input: {
  projectId: string; targetUrl: string; interval: WatchInterval; everyMinutes?: number | null; now: Date;
}) {
  const target = normalizeAuditNavigationUrl(input.targetUrl)
  const lifetime = siteCareIntervalMinutes(input.interval, input.everyMinutes) * 60_000 - SCHEDULER_TOLERANCE_MS
  const source = await db.audit.findFirst({ where: { projectId: input.projectId, status: { in: ['COMPLETED', 'FAILED'] },
    ...siteWideAnalysisAuditWhere,
    AND: [analysisEnvironmentWhere('production')],
    createdAt: { gt: new Date(input.now.getTime() - lifetime), lte: input.now },
  }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { id: true, url: true, executionSpec: true, createdAt: true, status: true,
    pages: { orderBy: [{ position: 'asc' }, { id: 'asc' }], take: INTERNAL_REVIEW_PAGE_CEILING, select: { url: true } },
    verifierExecutions: { where: interruptedAnalysisWorkWhere, select: { id: true }, take: 1 } } })
  // Select the Site's latest broad attempt before deciding whether it can be
  // reused. An older matching URL cannot conceal a failed branch of that Site.
  if (source?.status !== 'COMPLETED' || source.verifierExecutions.length) return null
  const entry = target.ok ? target.url : input.targetUrl
  const spec = readExecutionSpec(source.executionSpec)
  const compatible = spec?.scope === 'SITE' && spec.targetUrl === source.url && spec.environment === 'production'
  const recorded = [source.url, ...recordedPageUrls({ executionSpec: compatible ? spec : null, pages: source.pages })]
  const covered = new Set(recorded)
  // Sharing a Site does not make another path, query, port or fragment fresh.
  if (!covered.has(entry)) return null
  // Admission and freshness must agree about retained responsibilities, including
  // older analyses claimed after this source completed. None can disappear merely
  // because a more recent branch happened to finish successfully.
  const required = await monitoringResponsibility({ projectId: input.projectId, environment: 'production', targetUrl: entry, recorded }, db)
  return required.every(url => covered.has(url)) ? { id: source.id, renewAt: new Date(source.createdAt.getTime() + lifetime) } : null
}
