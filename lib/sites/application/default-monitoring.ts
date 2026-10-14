import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { resolveEffectiveEntitlements, type EffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { toStoredWatchInterval, fromStoredWatchInterval } from '@/lib/audit/watch-interval'
import { bindingForConfirmedKind } from '@/lib/sites/outcomes'
import { expectationForKind } from '@/lib/sites/outcome-kinds'
import { outcomeFreshnessMinutes } from './care-policy'
import { productTransaction } from '@/lib/billing/product-transaction'
import { logger } from '@/lib/logger'

function defaultCadence(policy: EffectiveEntitlements) {
  return (policy.plan !== 'FREE' || policy.sources.includes('ADMIN')) && policy.watchIntervals.includes('daily')
    ? 'daily' : policy.watchIntervals.includes('weekly') ? 'weekly' : null
}

/** Public availability needs no privileged consent. Persist defaults with Site identity. */
export async function ensureDefaultMonitoring(tx: Prisma.TransactionClient, projectId: string, userId: string, now = new Date()) {
  const project = await tx.project.findFirst({
    where: { id: projectId, userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
    select: { id: true, url: true, watchInterval: true, watchEveryMinutes: true, watchNextRunAt: true,
      watchLastAttemptAt: true, watchLastRunAt: true, watchLastError: true,
      user: { select: { id: true, role: true, plan: true, subscriptionStatus: true, lifecycleStatus: true,
        auditsLimit: true, deepReviewsLimit: true, licensedSiteQuantity: true,
        entitlementGrants: { where: { revokedAt: null, expiresAt: { gt: now } } } } } },
  })
  if (!project) return false
  const policy = resolveEffectiveEntitlements(project.user, project.user.entitlementGrants, now)
  if (!policy.available) return false
  const cadence = fromStoredWatchInterval(project.watchInterval) ?? defaultCadence(policy)
  if (!cadence || !policy.watchIntervals.includes(cadence)) return false
  // Repeated admissions and the worker backfill must honor an explicit pause.
  if (!project.watchInterval && (project.watchLastError || project.watchLastAttemptAt || project.watchLastRunAt)) return false
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
  if (!project.watchInterval) {
    await tx.project.updateMany({
      where: { id: projectId, userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' }, watchInterval: null, watchNextRunAt: null,
        watchLastAttemptAt: null, watchLastRunAt: null, watchLastError: null },
      data: { watchInterval: toStoredWatchInterval(cadence), watchNextRunAt: now },
    })
  }
  return true
}

/** Bounded worker upkeep covers existing Sites without a customer browser session. */
export async function initializeDefaultMonitoring(limit: number, now: Date) {
  const projects = await prisma.project.findMany({
    where: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' }, watchInterval: null, watchNextRunAt: null, watchLastAttemptAt: null,
      watchLastRunAt: null, watchLastError: null },
    select: { id: true, userId: true }, orderBy: { createdAt: 'asc' }, take: limit,
  })
  for (const project of projects) {
    try { await productTransaction(tx => ensureDefaultMonitoring(tx, project.id, project.userId, now)) }
    catch (error) { logger.error('Default monitoring initialization failed', error instanceof Error ? error : new Error(String(error)), { projectId: project.id }) }
  }
}
