import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { resolveEffectiveEntitlements, type EffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { calcWatchNextRun, toStoredWatchInterval, fromStoredWatchInterval, type WatchInterval } from '@/lib/audit/watch-interval'
import { bindingForConfirmedKind } from '@/lib/sites/outcomes'
import { expectationForKind } from '@/lib/sites/outcome-kinds'
import { outcomeFreshnessMinutes } from '../evidence-freshness'
import { productTransaction } from '@/lib/billing/product-transaction'
import { deferMonitoringSetup, runMonitoringSetup, selectMonitoringSetupSites, type MonitoringSetupSite } from './monitoring-setup'
import { logger } from '@/lib/logger'
import { systemClock, type Clock } from '@/lib/time/clock'
import { retargetDefaultAvailability } from './default-availability-target'
import { WATCH_MESSAGES } from '../watch-state'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { createInitialUptimeMonitor } from '@/lib/uptime/monitor-target'
import { uptimeProjectWhere } from '@/lib/uptime/eligibility'

export const MONITORING_SCHEDULE_UNAVAILABLE = WATCH_MESSAGES.scheduleUnavailable

function defaultCadence(policy: EffectiveEntitlements) {
  return (policy.plan !== 'FREE' || policy.sources.includes('ADMIN')) && policy.watchIntervals.includes('daily')
    ? 'daily' : policy.watchIntervals.includes('weekly') ? 'weekly' : null
}

type DefaultMonitoringOptions = {
  restored?: boolean
  /** The caller is admitting the Site's first check now; that check is the first run. */
  startsWithCheck?: boolean
}

/**
 * The owner's latest check is monitoring's first run. A check that is running
 * or finished completely moves the first scheduled run one cadence later, so a
 * new owner reads the results they signed up for instead of a repeat check.
 * A failed or partial check, or none, leaves the first run due now.
 */
async function firstScheduledRunAt(tx: Prisma.TransactionClient, projectId: string, cadence: WatchInterval, now: Date, startsWithCheck: boolean) {
  if (startsWithCheck) return calcWatchNextRun(cadence, now)
  const latest = await tx.audit.findFirst({ where: { projectId }, orderBy: { createdAt: 'desc' },
    select: { status: true, completedAt: true, reportCompleteness: true } })
  if (!latest || latest.status === 'FAILED') return now
  if (latest.status !== 'COMPLETED') return calcWatchNextRun(cadence, now)
  if (latest.reportCompleteness !== 'FULL' || !latest.completedAt) return now
  const next = calcWatchNextRun(cadence, latest.completedAt)
  return next > now ? next : now
}

/** Public availability needs no privileged consent. Persist defaults with Site identity. */
export async function ensureDefaultMonitoring(tx: Prisma.TransactionClient, projectId: string, userId: string, now = new Date(), options: DefaultMonitoringOptions = {}) {
  const project = await tx.project.findFirst({
    where: { id: projectId, userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
    select: { id: true, url: true, watchInterval: true, watchEveryMinutes: true, watchNextRunAt: true, watchPausedAt: true,
      watchLastAttemptAt: true, watchLastRunAt: true, watchLastError: true, watchLeaseUntil: true, monitoringSetupRetryAt: true, uptimeSetupRetryAt: true,
      uptimeMonitor: { select: { id: true } },
      user: { select: { id: true, role: true, plan: true, subscriptionStatus: true, lifecycleStatus: true,
        auditsLimit: true, deepReviewsLimit: true, licensedSiteQuantity: true,
        entitlementGrants: { where: { revokedAt: null, expiresAt: { gt: now } } } } } },
  })
  if (!project) return false
  if (project.watchPausedAt && !options.restored) return false
  const retainedCadence = fromStoredWatchInterval(project.watchInterval)
  const retainedUptime = Boolean(retainedCadence && !project.watchPausedAt)
  const uptimeTarget = !project.uptimeMonitor ? normalizeAuditUrl(project.url) : null
  // A saved schedule already grants basic uptime, even when analysis cadence
  // is halted. Keep the current Site and intent locked through monitor creation.
  if (retainedUptime && uptimeTarget?.ok) {
    const current = await tx.project.updateMany({ where: { ...uptimeProjectWhere, id: projectId, userId, url: project.url, uptimeMonitor: null },
      data: { uptimeSetupRetryAt: null } })
    if (current.count === 1) await createInitialUptimeMonitor(tx, projectId, uptimeTarget.url, now)
  }
  const policy = resolveEffectiveEntitlements(project.user, project.user.entitlementGrants, now)
  if (!policy.available) return false
  const cadence = retainedCadence ?? defaultCadence(policy)
  if (!cadence || !policy.watchIntervals.includes(cadence)) return false
  const policyHalted = Boolean(project.watchInterval && !project.watchNextRunAt &&
    project.watchLastError === MONITORING_SCHEDULE_UNAVAILABLE &&
    (!project.watchLeaseUntil || project.watchLeaseUntil <= now))
  // Repeated admissions and worker upkeep retain explicit pauses. Only an
  // owner admission that actually restored a removed Site starts defaults again.
  if (!options.restored && !project.watchInterval && (project.watchLastError || project.watchLastAttemptAt || project.watchLastRunAt)) return false
  await retargetDefaultAvailability(tx, { id: projectId, userId, url: project.url })
  const binding = bindingForConfirmedKind('AVAILABILITY', project.url)!
  await tx.siteOutcome.upsert({
    where: { projectId_slug: { projectId, slug: 'page-loads' } },
    create: { projectId, slug: 'page-loads', name: 'This page loads',
      description: 'The public page responds successfully.', kind: 'AVAILABILITY', criticality: 'IMPORTANT',
      expectation: expectationForKind('AVAILABILITY'), inferenceSource: 'automatic', confirmedAt: now,
      staleAfterMinutes: outcomeFreshnessMinutes(cadence, project.watchEveryMinutes), bindings: { create: binding } },
    // Keep identity, names, prior evidence and any owner-authored binding intact.
    update: {},
  })
  if (!project.watchInterval || policyHalted) {
    const firstRunAt = options.restored || policyHalted ? now
      : await firstScheduledRunAt(tx, projectId, cadence, now, options.startsWithCheck === true)
    const changed = await tx.project.updateMany({
      where: { id: projectId, userId, url: project.url, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' }, watchInterval: project.watchInterval, watchNextRunAt: null,
        watchPausedAt: project.watchPausedAt ?? null,
        watchLastAttemptAt: options.restored || policyHalted ? project.watchLastAttemptAt : null,
        watchLastRunAt: options.restored || policyHalted ? project.watchLastRunAt : null,
        watchLastError: options.restored || policyHalted ? project.watchLastError : null,
        ...(policyHalted ? { watchEveryMinutes: project.watchEveryMinutes, watchLeaseUntil: project.watchLeaseUntil } : {}) },
      data: { watchInterval: toStoredWatchInterval(cadence), watchNextRunAt: firstRunAt, watchPausedAt: null,
        ...(policyHalted ? { watchLeaseUntil: null, watchLastError: null } : {}),
        ...(options.restored ? { watchEveryMinutes: null, watchLeaseUntil: null, watchLastError: null, watchConsecutiveFailures: 0 } : {}),
        ...(project.monitoringSetupRetryAt ? { monitoringSetupRetryAt: null } : {}),
        ...(!retainedUptime && uptimeTarget?.ok && project.uptimeSetupRetryAt ? { uptimeSetupRetryAt: null } : {}) },
    })
    if (changed.count !== 1) return false
    if (!retainedUptime && uptimeTarget?.ok) await createInitialUptimeMonitor(tx, projectId, uptimeTarget.url, now)
    if (options.restored) await tx.siteOutcome.updateMany({ where: { projectId },
      data: { staleAfterMinutes: outcomeFreshnessMinutes(cadence) } })
  }
  return true
}

function selectDefaultMonitoringSites(db: Prisma.TransactionClient, now: Date, limit: number, expected?: MonitoringSetupSite) {
  return selectMonitoringSetupSites(db, 'monitoringSetupRetryAt', Prisma.sql`
    p."watchNextRunAt" IS NULL
    AND ((p."watchInterval" IS NULL AND p."watchLastAttemptAt" IS NULL AND p."watchLastRunAt" IS NULL AND p."watchLastError" IS NULL)
        OR (p."watchInterval" IS NOT NULL AND p."watchLastError" = ${MONITORING_SCHEDULE_UNAVAILABLE}
          AND (p."watchLeaseUntil" IS NULL OR p."watchLeaseUntil" <= ${now})))`, now, limit, expected)
}

/** Initialize untouched Sites and restore permitted cadences. Skip busy Sites
 * both before applying the batch limit and before writing their setup state. */
export async function initializeDefaultMonitoring(limit: number, clock: Clock = systemClock) {
  const projects = await selectDefaultMonitoringSites(prisma, clock.now(), limit)
  function setup(project: MonitoringSetupSite, retryOnly = false) {
    return productTransaction(async tx => {
      const now = clock.now()
      const [current] = await selectDefaultMonitoringSites(tx, now, 1, project)
      if (!current) return
      if (!retryOnly && await ensureDefaultMonitoring(tx, current.id, current.userId, now)) return
      await deferMonitoringSetup(tx, 'monitoringSetupRetryAt', current.id, now)
    })
  }
  await runMonitoringSetup(projects, async project => {
    try { await setup(project) }
    catch (error) {
      logger.error('Default monitoring initialization failed', error, { projectId: project.id })
      try { await setup(project, true) }
      catch (retryError) { logger.error('Default monitoring retry could not be scheduled', retryError, { projectId: project.id }) }
    }
  }, project => project.userId)
}
