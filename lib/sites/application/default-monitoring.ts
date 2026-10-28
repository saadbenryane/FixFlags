import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { resolveEffectiveEntitlements, type EffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { toStoredWatchInterval, fromStoredWatchInterval } from '@/lib/audit/watch-interval'
import { bindingForConfirmedKind } from '@/lib/sites/outcomes'
import { expectationForKind } from '@/lib/sites/outcome-kinds'
import { outcomeFreshnessMinutes } from '../evidence-freshness'
import { productTransaction } from '@/lib/billing/product-transaction'
import { deferMonitoringSetup, monitoringSetupDue, monitoringSetupOrder } from './monitoring-setup'
import { logger } from '@/lib/logger'
import { systemClock, type Clock } from '@/lib/time/clock'

export const MONITORING_SCHEDULE_UNAVAILABLE = 'This schedule is not available on your plan. Choose an available monitoring schedule.'

function defaultCadence(policy: EffectiveEntitlements) {
  return (policy.plan !== 'FREE' || policy.sources.includes('ADMIN')) && policy.watchIntervals.includes('daily')
    ? 'daily' : policy.watchIntervals.includes('weekly') ? 'weekly' : null
}

/** Public availability needs no privileged consent. Persist defaults with Site identity. */
export async function ensureDefaultMonitoring(tx: Prisma.TransactionClient, projectId: string, userId: string, now = new Date(), options: { restored?: boolean } = {}) {
  const project = await tx.project.findFirst({
    where: { id: projectId, userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
    select: { id: true, url: true, watchInterval: true, watchEveryMinutes: true, watchNextRunAt: true, watchPausedAt: true,
      watchLastAttemptAt: true, watchLastRunAt: true, watchLastError: true, watchLeaseUntil: true, monitoringSetupRetryAt: true,
      user: { select: { id: true, role: true, plan: true, subscriptionStatus: true, lifecycleStatus: true,
        auditsLimit: true, deepReviewsLimit: true, licensedSiteQuantity: true,
        entitlementGrants: { where: { revokedAt: null, expiresAt: { gt: now } } } } } },
  })
  if (!project) return false
  if (project.watchPausedAt && !options.restored) return false
  const policy = resolveEffectiveEntitlements(project.user, project.user.entitlementGrants, now)
  if (!policy.available) return false
  const cadence = fromStoredWatchInterval(project.watchInterval) ?? defaultCadence(policy)
  if (!cadence || !policy.watchIntervals.includes(cadence)) return false
  const policyHalted = Boolean(project.watchInterval && !project.watchNextRunAt &&
    project.watchLastError === MONITORING_SCHEDULE_UNAVAILABLE &&
    (!project.watchLeaseUntil || project.watchLeaseUntil <= now))
  // Repeated admissions and worker upkeep retain explicit pauses. Only an
  // owner admission that actually restored a removed Site starts defaults again.
  if (!options.restored && !project.watchInterval && (project.watchLastError || project.watchLastAttemptAt || project.watchLastRunAt)) return false
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
    const changed = await tx.project.updateMany({
      where: { id: projectId, userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' }, watchInterval: project.watchInterval, watchNextRunAt: null,
        watchPausedAt: project.watchPausedAt ?? null,
        watchLastAttemptAt: options.restored || policyHalted ? project.watchLastAttemptAt : null,
        watchLastRunAt: options.restored || policyHalted ? project.watchLastRunAt : null,
        watchLastError: options.restored || policyHalted ? project.watchLastError : null,
        ...(policyHalted ? { watchEveryMinutes: project.watchEveryMinutes, watchLeaseUntil: project.watchLeaseUntil } : {}) },
      data: { watchInterval: toStoredWatchInterval(cadence), watchNextRunAt: now, watchPausedAt: null,
        ...(policyHalted ? { watchLeaseUntil: null, watchLastError: null } : {}),
        ...(options.restored ? { watchEveryMinutes: null, watchLeaseUntil: null, watchLastError: null, watchConsecutiveFailures: 0 } : {}),
        ...(project.monitoringSetupRetryAt ? { monitoringSetupRetryAt: null } : {}) },
    })
    if (changed.count !== 1) return false
    if (options.restored) await tx.siteOutcome.updateMany({ where: { projectId },
      data: { staleAfterMinutes: outcomeFreshnessMinutes(cadence) } })
  }
  return true
}

/** Bounded upkeep initializes untouched Sites and retries schedules halted by
 * policy. The saved cadence must be allowed again; owner pauses remain separate. */
export async function initializeDefaultMonitoring(limit: number, clock: Clock = systemClock) {
  const selectedAt = clock.now()
  const eligible: Prisma.ProjectWhereInput = { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' },
    watchPausedAt: null, watchNextRunAt: null, OR: [
      { watchInterval: null, watchLastAttemptAt: null, watchLastRunAt: null, watchLastError: null },
      { watchInterval: { not: null }, watchLastError: MONITORING_SCHEDULE_UNAVAILABLE,
        OR: [{ watchLeaseUntil: null }, { watchLeaseUntil: { lte: selectedAt } }] },
    ] }
  const projects = await prisma.project.findMany({
    where: { AND: [eligible, monitoringSetupDue(selectedAt)] },
    select: { id: true, userId: true, url: true, monitoringSetupRetryAt: true }, orderBy: monitoringSetupOrder, take: limit,
  })
  for (const project of projects) {
    let initialized = false
    try { initialized = await productTransaction(tx => ensureDefaultMonitoring(tx, project.id, project.userId, clock.now())) }
    catch (error) { logger.error('Default monitoring initialization failed', error instanceof Error ? error : new Error(String(error)), { projectId: project.id }) }
    if (!initialized) await deferMonitoringSetup({ ...eligible, id: project.id, userId: project.userId,
      url: project.url, monitoringSetupRetryAt: project.monitoringSetupRetryAt }, clock.now())
  }
}
