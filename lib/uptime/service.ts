import type { Prisma } from '@prisma/client'
import { deferMonitoringSetup, monitoringSetupDue, monitoringSetupOrder } from '@/lib/sites/application/monitoring-setup'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { logger } from '@/lib/logger'
import { enqueueUptimeProbe, type UptimeJob } from './queue'
import { probeUptime } from './probe'
import { UPTIME_INTERVAL_MS, UPTIME_RETENTION_MS, uptimeTransition } from './domain'
import type { ProbeObservation } from './domain'
import type { UptimeMonitor } from '@prisma/client'
import { uptimeEligible, uptimeProjectInclude, type MonitoringProject } from './eligibility'
import { systemClock, type Clock } from '@/lib/time/clock'
const slot = (now: Date) => new Date(Math.floor(now.getTime() / UPTIME_INTERVAL_MS) * UPTIME_INTERVAL_MS)
const nextSlot = (now: Date) => new Date(slot(now).getTime() + UPTIME_INTERVAL_MS)

function currentProbeSlot(job: UptimeJob, scheduledAt: Date, now: Date) {
  return scheduledAt <= now && now.getTime() - scheduledAt.getTime() <= 2 * UPTIME_INTERVAL_MS &&
    (job.attempt === 2 || scheduledAt.getTime() === slot(now).getTime())
}

/** Synchronize activation and target generations without touching analysis schedules or credits. */
async function syncMonitor(snapshot: UptimeMonitor, project: MonitoringProject, now: Date) {
  const target = normalizeAuditUrl(project.url)
  const enabled = uptimeEligible(project) && target.ok
  const changed = target.ok && target.url !== snapshot.targetUrl
  const expiredConfirmation = snapshot.pendingFailureAt && now.getTime() - snapshot.pendingFailureAt.getTime() > UPTIME_INTERVAL_MS
  if (!changed && enabled === snapshot.enabled && !expiredConfirmation) return snapshot
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM uptime_monitors WHERE id = ${snapshot.id} FOR UPDATE`
    const current = await tx.uptimeMonitor.findUniqueOrThrow({ where: { id: snapshot.id } })
    if (current.version !== snapshot.version || current.targetUrl !== snapshot.targetUrl) return current
    if (changed) await tx.uptimeIncident.updateMany({ where: { monitorId: current.id, recoveredAt: null, supersededAt: null }, data: { supersededAt: now } })
    return tx.uptimeMonitor.update({ where: { id: current.id }, data: {
      enabled, ...(changed ? { targetUrl: target.url, version: { increment: 1 }, lastCheckedAt: null, lastScheduledAt: null } : {}),
      state: enabled ? 'unknown' : 'paused', nextProbeAt: enabled ? slot(now) : nextSlot(now),
      pendingFailureAt: null, pendingSlotAt: null, confirmationDueAt: null, leaseUntil: null, leaseToken: null,
      lastDispatchAttemptAt: null,
    } })
  })
}

/** Bounded sweeps plus durable due fields recover enqueue failures without a catch-up burst. */
export async function scheduleUptimeProbes(clock: Clock = systemClock, limit = 100, onlyProjectId?: string) {
  const setupCutoff = clock.now()
  const initializing: Prisma.ProjectWhereInput = { ...(onlyProjectId ? { id: onlyProjectId } : {}),
    user: { lifecycleStatus: 'ACTIVE' }, deletedAt: null, watchInterval: { not: null }, uptimeMonitor: null }
  const projects = await prisma.project.findMany({
    where: { ...initializing, ...monitoringSetupDue(setupCutoff) },
    include: uptimeProjectInclude, orderBy: monitoringSetupOrder, take: limit,
  })
  for (const project of projects) {
    const initializedAt = clock.now()
    let initialized = false
    try {
      const target = normalizeAuditUrl(project.url)
      if (target.ok && uptimeEligible(project)) {
        await prisma.uptimeMonitor.upsert({ where: { projectId: project.id }, update: {},
          create: { projectId: project.id, targetUrl: target.url, nextProbeAt: slot(initializedAt) } })
        initialized = true
        if (project.monitoringSetupRetryAt) await prisma.project.updateMany({ where: { id: project.id, userId: project.userId,
          url: project.url, monitoringSetupRetryAt: project.monitoringSetupRetryAt }, data: { monitoringSetupRetryAt: null } })
      }
    } catch (error) {
      logger.error('Uptime monitor initialization failed; Site remains eligible for retry', error, { projectId: project.id })
    }
    if (!initialized) await deferMonitoringSetup({ ...initializing, id: project.id, userId: project.userId, url: project.url,
      watchInterval: project.watchInterval, monitoringSetupRetryAt: project.monitoringSetupRetryAt }, clock.now())
  }
  const selectedAt = clock.now()
  const due = await prisma.uptimeMonitor.findMany({
    where: { ...(onlyProjectId?{projectId:onlyProjectId}:{}), project: { user:{lifecycleStatus:'ACTIVE'}, deletedAt: null, watchInterval: { not: null } },
      OR: [{ nextProbeAt: { lte: selectedAt } }, { confirmationDueAt: { lte: selectedAt } }],
      AND: [{ OR: [{ leaseUntil: null }, { leaseUntil: { lt: selectedAt } }] }] },
    include: { project: { include: uptimeProjectInclude } },
    orderBy: [{ lastDispatchAttemptAt: { sort: 'asc', nulls: 'first' } }, { nextProbeAt: 'asc' }, { id: 'asc' }], take: limit,
  })
  for (const snapshot of due) {
    try {
      const monitor = await syncMonitor(snapshot, snapshot.project, clock.now())
      if (!monitor.enabled || !uptimeEligible(snapshot.project)) {
        await prisma.uptimeMonitor.updateMany({ where: { id: monitor.id, version: monitor.version }, data: { nextProbeAt: nextSlot(clock.now()) } })
        continue
      }
      // Record an attempt before publishing, so failed or unexecuted jobs cannot monopolize a batch.
      // Only the worker's observation advances due times or establishes reachability evidence.
      const attemptedAt = clock.now()
      const attempted = await prisma.uptimeMonitor.updateMany({ where: {
        id: monitor.id, version: monitor.version, targetUrl: monitor.targetUrl, enabled: true,
        lastDispatchAttemptAt: monitor.lastDispatchAttemptAt, nextProbeAt: monitor.nextProbeAt,
        confirmationDueAt: monitor.confirmationDueAt, pendingSlotAt: monitor.pendingSlotAt,
        OR: [{ leaseUntil: null }, { leaseUntil: { lt: attemptedAt } }],
        project: { id: monitor.projectId, userId: snapshot.project.userId, url: snapshot.project.url,
          deletedAt: null, user: { lifecycleStatus: 'ACTIVE' }, watchInterval: { not: null } },
      }, data: { lastDispatchAttemptAt: attemptedAt } })
      if (!attempted.count) continue
      if (monitor.pendingFailureAt && monitor.pendingSlotAt && monitor.confirmationDueAt) {
        await enqueueUptimeProbe({ monitorId: monitor.id, version: monitor.version, scheduledAt: monitor.pendingSlotAt.toISOString(), attempt: 2 }, monitor.confirmationDueAt)
      } else {
        const publishedAt = clock.now()
        await enqueueUptimeProbe({ monitorId: monitor.id, version: monitor.version, scheduledAt: slot(publishedAt).toISOString(), attempt: 1 }, publishedAt)
      }
    } catch (error) { logger.error('Uptime dispatch failed; persisted due intent retained', error) }
  }
}

/** Queue payloads carry references, never a URL or owner authority. */
export async function executeUptimeProbe(job: UptimeJob, observe: (url: string) => Promise<ProbeObservation> = probeUptime,
  clock: Clock = systemClock) {
  const now = clock.now(), scheduledAt = new Date(job.scheduledAt), token = randomUUID()
  if (!currentProbeSlot(job, scheduledAt, now)) return
  const snapshot = await prisma.uptimeMonitor.findUnique({ where: { id: job.monitorId }, include: { project: { include: uptimeProjectInclude } } })
  if (!snapshot || snapshot.version !== job.version) return
  const monitor = await syncMonitor(snapshot, snapshot.project, clock.now())
  if (monitor.version !== job.version || !monitor.enabled || !uptimeEligible(snapshot.project)) return
  // Complete authority reads before spending the observation lease.
  const currentProject = await prisma.project.findUnique({ where: { id: monitor.projectId }, include: uptimeProjectInclude })
  if (!currentProject || !uptimeEligible(currentProject) || normalizeAuditUrl(currentProject.url).ok === false || currentProject.url !== snapshot.project.url) return
  const claimedAt = clock.now()
  if (!currentProbeSlot(job, scheduledAt, claimedAt)) return
  const leaseUntil = new Date(claimedAt.getTime() + 30_000)
  const claimed = await prisma.uptimeMonitor.updateMany({ where: {
    id: job.monitorId, version: job.version, enabled: true,
    OR: [{ leaseUntil: null }, { leaseUntil: { lt: claimedAt } }],
    project: { id: currentProject.id, userId: currentProject.user.id, url: currentProject.url, deletedAt: null,
      user: { lifecycleStatus: 'ACTIVE' }, watchInterval: { not: null } },
    ...(job.attempt === 1 ? { nextProbeAt: { lte: claimedAt }, AND: [{ OR: [{ lastScheduledAt: null }, { lastScheduledAt: { lt: scheduledAt } }] }] }
      : { pendingSlotAt: scheduledAt, confirmationDueAt: { lte: claimedAt }, pendingFailureAt: { gt: new Date(claimedAt.getTime() - UPTIME_INTERVAL_MS) } }),
  }, data: { leaseUntil, leaseToken: token } })
  if (!claimed.count) return
  try {
    const startedAt = clock.now()
    if (startedAt >= leaseUntil || !currentProbeSlot(job, scheduledAt, startedAt) ||
      job.attempt === 2 && monitor.pendingFailureAt && startedAt.getTime() - monitor.pendingFailureAt.getTime() >= UPTIME_INTERVAL_MS) return
    const observation = await observe(monitor.targetUrl)
    const observedAt = clock.now()
    const confirmAt = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM uptime_monitors WHERE id = ${monitor.id} FOR UPDATE`
      const current = await tx.uptimeMonitor.findUniqueOrThrow({ where: { id: monitor.id }, include: { project: { include: uptimeProjectInclude } } })
      if (current.leaseToken !== token || current.version !== job.version || !uptimeEligible(current.project) || current.project.url !== currentProject.url) return
      const existing = await tx.uptimeProbe.findUnique({ where: { monitorId_version_scheduledAt_attempt: {
        monitorId: monitor.id, version: job.version, scheduledAt, attempt: job.attempt,
      } } })
      if (existing) return
      const incident = await tx.uptimeIncident.findFirst({ where: { monitorId: monitor.id, version: job.version, recoveredAt: null, supersededAt: null } })
      const transition = uptimeTransition({ result: observation.result, now: observedAt, confirmation: job.attempt === 2,
        pendingFailureAt: current.pendingFailureAt, incidentOpen: Boolean(incident) })
      await tx.uptimeProbe.create({ data: { monitorId: monitor.id, version: job.version, targetUrl: monitor.targetUrl,
        scheduledAt, observedAt, attempt: job.attempt, ...observation, confirmed: observation.result === 'FAILED' && transition.state === 'offline' } })
      if (transition.event === 'opened') {
        const opened = await tx.uptimeIncident.create({ data: { monitorId: monitor.id, version: job.version, targetUrl: monitor.targetUrl,
          startedAt: current.pendingFailureAt!, confirmedAt: observedAt, reason: observation.reason } })
        await tx.uptimeNotification.create({ data: { incidentId: opened.id, kind: 'DOWN' } })
      } else if (transition.event === 'recovered' && incident) {
        await tx.uptimeIncident.update({ where: { id: incident.id }, data: { recoveredAt: observedAt } })
        await tx.uptimeNotification.create({ data: { incidentId: incident.id, kind: 'RECOVERED' } })
      }
      await tx.uptimeMonitor.update({ where: { id: monitor.id }, data: {
        state: transition.state, lastCheckedAt: observedAt, leaseUntil: null, leaseToken: null,
        pendingFailureAt: transition.pendingFailureAt, pendingSlotAt: transition.confirmAt ? scheduledAt : null,
        confirmationDueAt: transition.confirmAt, ...(job.attempt === 1 ? { lastScheduledAt: scheduledAt, nextProbeAt: nextSlot(observedAt) } : {}),
      } })
      return transition.confirmAt
    })
    if (confirmAt) {
      try { await enqueueUptimeProbe({ ...job, attempt: 2 }, confirmAt) }
      catch (error) { logger.error('Uptime confirmation dispatch failed; due intent retained', error) }
    }
  } finally {
    await prisma.uptimeMonitor.updateMany({ where: { id: monitor.id, leaseToken: token }, data: { leaseUntil: null, leaseToken: null } })
  }
}

export async function retainUptimeHistory(now = new Date()) {
  await prisma.uptimeProbe.deleteMany({ where: { observedAt: { lt: new Date(now.getTime() - UPTIME_RETENTION_MS) } } })
}
