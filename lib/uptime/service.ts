import { Prisma } from '@prisma/client'
import { deferMonitoringSetup, MONITORING_SETUP_UNAVAILABLE_RETRY_MS, runMonitoringSetup, selectMonitoringSetupSites } from '@/lib/sites/application/monitoring-setup'
import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/db'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { logger } from '@/lib/logger'
import { enqueueUptimeProbe, type UptimeJob } from './queue'
import { probeUptime, recordedUptimeFinalUrl } from './probe'
import { UPTIME_INTERVAL_MS, UPTIME_RETENTION_MS, uptimeConfirmationCutoff, uptimeSlotStart, uptimeTransition } from './domain'
import type { ProbeObservation } from './domain'
import type { UptimeMonitor } from '@prisma/client'
import { uptimeEligible, uptimeProjectWhere, type MonitoringProject } from './eligibility'
import { nextAttemptTimestamp, systemClock, type Clock } from '@/lib/time/clock'
import { lockAdminSiteOperation, type AdminSiteOperationScope } from '@/lib/admin/domain-actor'
import { AdminActionError } from '@/lib/admin/errors'
import { applyUptimeMonitorTransition, createInitialUptimeMonitor } from './monitor-target'
const UPTIME_DISPATCH_CONCURRENCY = 4
const UPTIME_RETENTION_BATCH_SIZE = 5_000
const slot = (now: Date) => new Date(uptimeSlotStart(now.getTime()))
const nextSlot = (now: Date) => new Date(slot(now).getTime() + UPTIME_INTERVAL_MS)
const scheduleProjectSelect = { id: true, userId: true, url: true, deletedAt: true, watchInterval: true, watchNextRunAt: true,
  watchPausedAt: true, user: { select: { id: true, lifecycleStatus: true } } } satisfies Prisma.ProjectSelect

type UptimeScheduleScope = string | AdminSiteOperationScope

function withUptimeScheduleWrite<T>(authority: AdminSiteOperationScope | undefined, write: (db: Prisma.TransactionClient) => Promise<T>) {
  if (!authority) return write(prisma)
  return prisma.$transaction(async tx => {
    await lockAdminSiteOperation(authority, tx)
    return write(tx)
  })
}

function availableMonitorRow(id: string) {
  return Prisma.sql`SELECT id FROM uptime_monitors WHERE id = ${id} FOR UPDATE SKIP LOCKED`
}

function eligibleMonitorProject(projectId: string, userId: string, url: string) {
  return Prisma.sql`EXISTS (SELECT 1 FROM projects p JOIN users u ON u.id = p."userId"
    WHERE p.id = m."projectId" AND p.id = ${projectId} AND p."userId" = ${userId}
      AND p.url = ${url} AND p."deletedAt" IS NULL
      AND u."lifecycleStatus" = 'ACTIVE' AND p."watchInterval" IS NOT NULL AND p."watchPausedAt" IS NULL)`
}

function eligibleProbeSlot(job: UptimeJob, scheduledAt: Date, now: Date) {
  // A confirmation keeps its original slot, but its expiry is measured from
  // the persisted failed observation, which can complete in a later slot.
  return job.attempt === 1 ? scheduledAt.getTime() === slot(now).getTime() : scheduledAt <= now
}

/** Synchronize activation and target generations without touching analysis schedules or credits. */
async function syncMonitor(snapshot: UptimeMonitor, project: MonitoringProject, now: Date, authority?: AdminSiteOperationScope) {
  const transition = monitorSynchronization(snapshot, project, now)
  if (!transition) return snapshot
  return prisma.$transaction(async tx => {
    if (authority) await lockAdminSiteOperation(authority, tx)
    const locked = await tx.$queryRaw<Array<{ id: string }>>(availableMonitorRow(snapshot.id))
    if (!locked.length) return null
    const current = await tx.uptimeMonitor.findUnique({ where: { id: snapshot.id }, include: { project: { select: scheduleProjectSelect } } })
    if (!current || authority && current.projectId !== authority.projectId) return null
    if (current.version !== snapshot.version || current.targetUrl !== snapshot.targetUrl) return current
    // The selection is only a hint. A worker may have completed an observation
    // or acquired its lease while this caller was waiting for the row lock.
    const latest = monitorSynchronization(current, current.project, now)
    if (!latest) return current
    return applyUptimeMonitorTransition(tx, current, latest, now)
  })
}

function monitorSynchronization(monitor: UptimeMonitor, project: MonitoringProject, now: Date) {
  const target = normalizeAuditUrl(project.url)
  const enabled = uptimeEligible(project) && target.ok
  const changed = target.ok && target.url !== monitor.targetUrl
  const leased = monitor.leaseUntil && monitor.leaseUntil > now
  const expiredConfirmation = !leased && monitor.pendingFailureAt && monitor.pendingFailureAt <= uptimeConfirmationCutoff(now)
  return changed || enabled !== monitor.enabled || expiredConfirmation ? { targetUrl: target.ok ? target.url : monitor.targetUrl, enabled, changed } : null
}

const uptimeSetupEligible = Prisma.sql`p."watchInterval" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM uptime_monitors m WHERE m."projectId" = p.id)`

/** Prepare missing monitors without making independent Sites wait on busy rows. */
export async function initializeUptimeMonitors(clock: Clock = systemClock, limit = 100, scope?: UptimeScheduleScope) {
  const authority = typeof scope === 'object' ? scope : undefined
  const onlyProjectId = typeof scope === 'string' ? scope : scope?.projectId
  const retryField = 'uptimeSetupRetryAt'
  const projects = await selectMonitoringSetupSites(prisma, retryField, uptimeSetupEligible, clock.now(), limit,
    { id: onlyProjectId, userId: authority?.userId })
  await runMonitoringSetup(projects, async project => {
    const target = normalizeAuditUrl(project.url)
    const setup = (retryOnly = false) => prisma.$transaction(async tx => {
      if (authority) await lockAdminSiteOperation(authority, tx)
      const now = clock.now()
      const [current] = await selectMonitoringSetupSites(tx, retryField, uptimeSetupEligible, now, 1, project)
      if (!current) return
      if (retryOnly || !target.ok) {
        await deferMonitoringSetup(tx, retryField, current.id, now, target.ok ? undefined : MONITORING_SETUP_UNAVAILABLE_RETRY_MS)
        return
      }
      await createInitialUptimeMonitor(tx, current.id, target.url, now)
      if (current.retryAt) await tx.project.updateMany({ where: { id: current.id }, data: { uptimeSetupRetryAt: null } })
    })
    try { await setup() }
    catch (error) {
      if (error instanceof AdminActionError) throw error
      logger.error('Uptime monitor initialization failed; Site remains eligible for retry', error, { projectId: project.id })
      try { await setup(true) }
      catch (retryError) {
        if (retryError instanceof AdminActionError) throw retryError
        logger.error('Uptime monitor setup retry could not be scheduled', retryError, { projectId: project.id })
      }
    }
  }, project => project.id)
}

/** Due monitors cannot wait for unrelated setup. Durable due fields recover
 * enqueue failures without a catch-up burst or synthetic observations. */
export async function dispatchDueUptimeProbes(clock: Clock = systemClock, limit = 100, scope?: UptimeScheduleScope) {
  const authority = typeof scope === 'object' ? scope : undefined
  const onlyProjectId = typeof scope === 'string' ? scope : scope?.projectId
  const selectedAt = clock.now()
  const result = { published: 0, failed: 0 }
  // Locked rows must not consume the bounded cohort. The atomic attempt update
  // below also yields if a row becomes busy after this short selection ends.
  const available = await prisma.$queryRaw<Array<{ id: string }>>`SELECT m.id
    FROM uptime_monitors m JOIN projects p ON p.id = m."projectId" JOIN users u ON u.id = p."userId"
    WHERE p."deletedAt" IS NULL AND u."lifecycleStatus" = 'ACTIVE' AND p."watchInterval" IS NOT NULL AND p."watchPausedAt" IS NULL
      ${onlyProjectId ? Prisma.sql`AND p.id = ${onlyProjectId}` : Prisma.empty}
      ${authority ? Prisma.sql`AND p."userId" = ${authority.userId}` : Prisma.empty}
      AND (m."confirmationDueAt" <= ${selectedAt} OR (m."confirmationDueAt" IS NULL AND m."nextProbeAt" <= ${selectedAt}))
      AND (m."leaseUntil" IS NULL OR m."leaseUntil" < ${selectedAt})
    ORDER BY m."lastDispatchAttemptAt" ASC NULLS FIRST, m."nextProbeAt" ASC, m.id ASC
    LIMIT ${limit} FOR UPDATE OF m SKIP LOCKED`
  if (!available.length) return result
  const due = await prisma.uptimeMonitor.findMany({
    where: { id: { in: available.map(monitor => monitor.id) }, ...(onlyProjectId?{projectId:onlyProjectId}:{}),
      project: { ...uptimeProjectWhere, ...(authority ? { userId: authority.userId } : {}) },
      OR: [{ confirmationDueAt: { lte: selectedAt } }, { confirmationDueAt: null, nextProbeAt: { lte: selectedAt } }],
      AND: [{ OR: [{ leaseUntil: null }, { leaseUntil: { lt: selectedAt } }] }] },
    include: { project: { select: scheduleProjectSelect } },
    orderBy: [{ lastDispatchAttemptAt: { sort: 'asc', nulls: 'first' } }, { nextProbeAt: 'asc' }, { id: 'asc' }], take: limit,
  })
  async function publish(snapshot: (typeof due)[number]) {
    try {
      const monitor = await syncMonitor(snapshot, snapshot.project, clock.now(), authority)
      if (!monitor || !uptimeEligible(snapshot.project)) return
      if (!monitor.enabled) {
        // A stale disabled snapshot cannot defer work after the Site resumes.
        await withUptimeScheduleWrite(authority, db => db.$executeRaw`UPDATE uptime_monitors m
          SET "nextProbeAt" = ${nextSlot(clock.now())}, "updatedAt" = CURRENT_TIMESTAMP
          WHERE m.id IN (${availableMonitorRow(monitor.id)}) AND m.version = ${monitor.version}
          AND NOT m.enabled AND m."targetUrl" = ${monitor.targetUrl} AND m."nextProbeAt" = ${monitor.nextProbeAt}
          AND ${eligibleMonitorProject(monitor.projectId, snapshot.project.userId, snapshot.project.url)}`)
        return
      }
      // Record an attempt before publishing, so failed or unexecuted jobs cannot monopolize a batch.
      // Only the worker's observation advances due times or establishes reachability evidence.
      const attemptedAt = clock.now()
      if ((monitor.confirmationDueAt ?? monitor.nextProbeAt) > attemptedAt) return
      const nextUnusedSlot = !monitor.confirmationDueAt && monitor.lastScheduledAt && monitor.lastScheduledAt >= slot(attemptedAt)
        ? nextSlot(monitor.lastScheduledAt) : null
      // Advancing the marker also fences publishers that read the same row
      // when the clock has not advanced since the previous dispatch attempt.
      const dispatchAttemptAt = nextAttemptTimestamp(attemptedAt, monitor.lastDispatchAttemptAt)
      const attempted = await withUptimeScheduleWrite(authority, db => db.$executeRaw`UPDATE uptime_monitors m
        SET "lastDispatchAttemptAt" = ${dispatchAttemptAt}, "updatedAt" = CURRENT_TIMESTAMP,
          "nextProbeAt" = COALESCE(${nextUnusedSlot}::timestamp, m."nextProbeAt")
        WHERE m.id IN (${availableMonitorRow(monitor.id)})
          AND m.version = ${monitor.version} AND m."targetUrl" = ${monitor.targetUrl} AND m.enabled
          AND m."lastDispatchAttemptAt" IS NOT DISTINCT FROM ${monitor.lastDispatchAttemptAt}
          AND m."lastScheduledAt" IS NOT DISTINCT FROM ${monitor.lastScheduledAt}
          AND m."nextProbeAt" = ${monitor.nextProbeAt}
          AND m."confirmationDueAt" IS NOT DISTINCT FROM ${monitor.confirmationDueAt}
          AND m."pendingSlotAt" IS NOT DISTINCT FROM ${monitor.pendingSlotAt}
          AND (m."leaseUntil" IS NULL OR m."leaseUntil" < ${attemptedAt})
          AND ${eligibleMonitorProject(monitor.projectId, snapshot.project.userId, snapshot.project.url)}`)
      if (!attempted || nextUnusedSlot) return
      if (monitor.pendingFailureAt && monitor.pendingSlotAt && monitor.confirmationDueAt) {
        await enqueueUptimeProbe({ monitorId: monitor.id, version: monitor.version, scheduledAt: monitor.pendingSlotAt.toISOString(), attempt: 2 }, monitor.confirmationDueAt)
      } else {
        const publishedAt = clock.now()
        await enqueueUptimeProbe({ monitorId: monitor.id, version: monitor.version, scheduledAt: slot(publishedAt).toISOString(), attempt: 1 }, publishedAt)
      }
      result.published++
    } catch (error) {
      if (error instanceof AdminActionError) throw error
      result.failed++
      logger.error('Uptime dispatch failed; persisted due intent retained', error)
    }
  }

  // Each lane takes the next eligible monitor as soon as its publication settles.
  // A slow broker command therefore occupies one lane instead of the entire sweep.
  const pending = due.values()
  const laneCount = Math.min(UPTIME_DISPATCH_CONCURRENCY, due.length)
  await Promise.all(Array.from({ length: laneCount }, async () => {
    for (const snapshot of pending) await publish(snapshot)
  }))
  return result
}

/** Explicit Site reconciliation prepares its monitor and dispatches the current slot. */
export async function scheduleUptimeProbes(clock: Clock = systemClock, limit = 100, scope?: UptimeScheduleScope) {
  if (typeof scope === 'object') await prisma.$transaction(tx => lockAdminSiteOperation(scope, tx))
  await initializeUptimeMonitors(clock, limit, scope)
  return dispatchDueUptimeProbes(clock, limit, scope)
}

/** Queue payloads carry references, never a URL or owner authority. */
export async function executeUptimeProbe(job: UptimeJob, observe: (url: string) => Promise<ProbeObservation> = probeUptime,
  clock: Clock = systemClock) {
  const now = clock.now(), scheduledAt = new Date(job.scheduledAt), token = randomUUID()
  if (!eligibleProbeSlot(job, scheduledAt, now)) return
  const snapshot = await prisma.uptimeMonitor.findUnique({ where: { id: job.monitorId }, include: { project: { select: scheduleProjectSelect } } })
  if (!snapshot || snapshot.version !== job.version) return
  const monitor = await syncMonitor(snapshot, snapshot.project, clock.now())
  if (!monitor || monitor.version !== job.version || !monitor.enabled || !uptimeEligible(snapshot.project)) return
  // Complete authority reads before spending the observation lease.
  const currentProject = await prisma.project.findUnique({ where: { id: monitor.projectId }, select: scheduleProjectSelect })
  if (!currentProject || !uptimeEligible(currentProject) || normalizeAuditUrl(currentProject.url).ok === false || currentProject.url !== snapshot.project.url) return
  const claimedAt = clock.now()
  if (!eligibleProbeSlot(job, scheduledAt, claimedAt)) return
  const leaseUntil = new Date(claimedAt.getTime() + 30_000)
  const dueSlot = job.attempt === 1
    ? Prisma.sql`m."nextProbeAt" <= ${claimedAt} AND m."confirmationDueAt" IS NULL
        AND (m."lastScheduledAt" IS NULL OR m."lastScheduledAt" < ${scheduledAt})`
    : Prisma.sql`m."pendingSlotAt" = ${scheduledAt} AND m."confirmationDueAt" <= ${claimedAt}
        AND m."pendingFailureAt" > ${uptimeConfirmationCutoff(claimedAt)}`
  // A busy monitor leaves its due slot for the scheduler and releases this worker lane.
  const claimed = await prisma.$executeRaw`UPDATE uptime_monitors m
    SET "leaseUntil" = ${leaseUntil}, "leaseToken" = ${token}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE m.id IN (${availableMonitorRow(monitor.id)})
      AND m.version = ${job.version} AND m."targetUrl" = ${monitor.targetUrl} AND m.enabled
      AND (m."leaseUntil" IS NULL OR m."leaseUntil" < ${claimedAt})
      AND ${eligibleMonitorProject(currentProject.id, currentProject.user.id, currentProject.url)}
      AND ${dueSlot}`
  if (!claimed) return
  let publication: { confirmAt: Date | null } | undefined
  try {
    const startedAt = clock.now()
    if (startedAt >= leaseUntil || !eligibleProbeSlot(job, scheduledAt, startedAt) ||
      job.attempt === 2 && monitor.pendingFailureAt && monitor.pendingFailureAt <= uptimeConfirmationCutoff(startedAt)) return
    const observation = await observe(monitor.targetUrl)
    const observedAt = clock.now()
    publication = await prisma.$transaction(async tx => {
      // Keep authority stable through the evidence and incident writes. Match
      // account and Site commands' lock order before claiming the monitor row.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${currentProject.user.id} FOR SHARE`
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${currentProject.id} FOR SHARE`
      await tx.$queryRaw`SELECT id FROM uptime_monitors WHERE id = ${monitor.id} FOR UPDATE`
      const current = await tx.uptimeMonitor.findUnique({ where: { id: monitor.id }, include: { project: { select: scheduleProjectSelect } } })
      // Removal can commit while the public request or a row lock is pending.
      // A vanished monitor cancels this observation without recreating state.
      if (!current || current.leaseToken !== token || !current.leaseUntil || current.leaseUntil <= clock.now() ||
        current.version !== job.version || current.targetUrl !== monitor.targetUrl || !current.enabled ||
        current.project.user.id !== currentProject.user.id || !uptimeEligible(current.project) || current.project.url !== currentProject.url) return
      const existing = await tx.uptimeProbe.findUnique({ where: { monitorId_version_scheduledAt_attempt: {
        monitorId: monitor.id, version: job.version, scheduledAt, attempt: job.attempt,
      } } })
      if (existing) return
      const incident = await tx.uptimeIncident.findFirst({ where: { monitorId: monitor.id, version: job.version, recoveredAt: null, supersededAt: null } })
      const transition = uptimeTransition({ result: observation.result, now: observedAt, confirmation: job.attempt === 2,
        pendingFailureAt: current.pendingFailureAt, incidentOpen: Boolean(incident) })
      const finalUrl = recordedUptimeFinalUrl(observation)
      await tx.uptimeProbe.create({ data: { monitorId: monitor.id, version: job.version, targetUrl: monitor.targetUrl,
        scheduledAt, observedAt, attempt: job.attempt, ...observation, finalUrl,
        confirmed: observation.result === 'FAILED' && transition.state === 'offline' } })
      if (transition.event === 'opened') {
        const failureOrigin = observation.statusCode === null ? finalUrl : null
        const opened = await tx.uptimeIncident.create({ data: { monitorId: monitor.id, version: job.version, targetUrl: monitor.targetUrl,
          startedAt: current.pendingFailureAt!, confirmedAt: observedAt, reason: observation.reason, failureOrigin } })
        await tx.uptimeNotification.create({ data: { incidentId: opened.id, kind: 'DOWN' } })
      } else if (transition.event === 'recovered' && incident) {
        // Changing the outage receipt in this transaction fences a concurrent
        // unclaimed send. An already admitted attempt retains its lease.
        await tx.uptimeNotification.updateMany({
          where: { incidentId: incident.id, kind: 'DOWN', status: { in: ['PENDING', 'FAILED', 'SENDING'] },
            OR: [{ leaseUntil: null }, { leaseUntil: { lt: clock.now() } }] },
          data: { status: 'SKIPPED', leaseUntil: null },
        })
        await tx.uptimeIncident.update({ where: { id: incident.id }, data: { recoveredAt: observedAt } })
        await tx.uptimeNotification.create({ data: { incidentId: incident.id, kind: 'RECOVERED' } })
      }
      await tx.uptimeMonitor.update({ where: { id: monitor.id }, data: {
        state: transition.state, lastCheckedAt: observedAt, leaseUntil: null, leaseToken: null,
        pendingFailureAt: transition.pendingFailureAt, pendingSlotAt: transition.confirmAt ? scheduledAt : null,
        // A late response still belongs to its admitted slot. Leave the next slot due even if it has started.
        confirmationDueAt: transition.confirmAt, ...(job.attempt === 1 ? { lastScheduledAt: scheduledAt, nextProbeAt: nextSlot(scheduledAt) } : {}),
      } })
      return { confirmAt: transition.confirmAt }
    })
  } finally {
    // The publication clears its lease atomically. For unfinished work, the
    // exact lease expires on its own if cleanup fails.
    if (!publication) {
      try {
        await prisma.uptimeMonitor.updateMany({ where: { id: monitor.id, leaseToken: token }, data: { leaseUntil: null, leaseToken: null } })
      } catch (error) {
        logger.error('Uptime probe lease release failed. Scheduled probe remains due', error, { monitorId: monitor.id })
      }
    }
  }
  if (publication?.confirmAt) {
    try { await enqueueUptimeProbe({ ...job, attempt: 2 }, publication.confirmAt) }
    catch (error) { logger.error('Uptime confirmation dispatch failed; due intent retained', error) }
  }
}

export async function retainUptimeHistory(now = new Date()) {
  const cutoff = new Date(now.getTime() - UPTIME_RETENTION_MS)
  const [result] = await prisma.$queryRaw<Array<{ remaining: boolean }>>`
    WITH expired AS (
      SELECT id FROM uptime_probes
      WHERE "observedAt" < ${cutoff}
      ORDER BY "observedAt"
      LIMIT ${UPTIME_RETENTION_BATCH_SIZE} FOR UPDATE SKIP LOCKED
    ), removed AS (
      DELETE FROM uptime_probes p USING expired
      WHERE p.id = expired.id
      RETURNING p.id
    )
    SELECT EXISTS (
      SELECT 1 FROM uptime_probes
      WHERE "observedAt" < ${cutoff} AND id NOT IN (SELECT id FROM removed)
    ) AS remaining`
  return result.remaining
}
