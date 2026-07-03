import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { startRecheckAudit } from '@/lib/audit/recheck'
import { getEntitlements } from '@/lib/auth/entitlements'
import { createQueueRedis } from '@/lib/queue/redis'
import type { User } from '@prisma/client'

const SCHEDULES_KEY = 'recheck:schedules'
const SCHEDULE_INDEX_KEY = 'recheck:index'

export interface RecheckSchedule {
  id: string
  userId: string
  auditId: string
  interval: 'daily' | 'weekly' | 'bi-weekly' | 'hourly'
  lastRunAt?: string
  nextRunAt: string
  isActive: boolean
  timezone?: string
  cost: number
  plan?: string
}

export interface RecheckScheduleOptions {
  interval: RecheckSchedule['interval']
  timezone?: string
  costPerRun?: number
}

function calcNextRun(interval: RecheckSchedule['interval'], from?: Date): Date {
  const now = from ?? new Date()
  const ms: Record<string, number> = {
    hourly: 60 * 60 * 1000,
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    'bi-weekly': 14 * 24 * 60 * 60 * 1000,
  }
  return new Date(now.getTime() + (ms[interval] ?? ms.weekly))
}

function intervalCost(interval: RecheckSchedule['interval']): number {
  return { hourly: 0.10, daily: 0.50, weekly: 2.00, 'bi-weekly': 3.00 }[interval] ?? 1.00
}

async function getRedis() {
  return createQueueRedis()
}

export class RecheckScheduler {
  async createSchedule(userId: string, auditId: string, options: RecheckScheduleOptions): Promise<RecheckSchedule> {
    const now = new Date()
    const schedule: RecheckSchedule = {
      id: crypto.randomUUID(),
      userId,
      auditId,
      interval: options.interval,
      nextRunAt: calcNextRun(options.interval, now).toISOString(),
      isActive: true,
      timezone: options.timezone || 'UTC',
      cost: options.costPerRun ?? intervalCost(options.interval),
    }

    const redis = await getRedis()
    await redis.hset(SCHEDULES_KEY, schedule.id, JSON.stringify(schedule))
    await redis.zadd(SCHEDULE_INDEX_KEY, new Date(schedule.nextRunAt).getTime(), schedule.id)
    await redis.quit()

    logger.info('Recheck schedule created', { scheduleId: schedule.id, userId, interval: options.interval })
    return schedule
  }

  async processDue(): Promise<number> {
    const redis = await getRedis()
    const now = Date.now()
    const dueIds = await redis.zrangebyscore(SCHEDULE_INDEX_KEY, 0, now)
    if (dueIds.length === 0) {
      await redis.quit()
      return 0
    }

    const raw = await redis.hmget(SCHEDULES_KEY, ...dueIds)
    const schedules: RecheckSchedule[] = raw
      .filter((r): r is string => r !== null)
      .map((r) => JSON.parse(r))
      .filter((s) => s.isActive)

    let processed = 0
    for (const schedule of schedules) {
      try {
        const user = await prisma.user.findUnique({ where: { id: schedule.userId } })
        if (!user) {
          logger.warn('Schedule user not found, deactivating', { scheduleId: schedule.id, userId: schedule.userId })
          schedule.isActive = false
          await redis.hset(SCHEDULES_KEY, schedule.id, JSON.stringify(schedule))
          await redis.zrem(SCHEDULE_INDEX_KEY, schedule.id)
          continue
        }

        const entitlements = getEntitlements({
          id: user.id,
          role: user.role,
          plan: user.plan,
          subscriptionStatus: user.subscriptionStatus,
        })
        if (!entitlements.canRecheck) {
          logger.warn('User cannot recheck, skipping', { userId: user.id })
          continue
        }

        const outcome = await startRecheckAudit(schedule.auditId, user as User)
        if (!outcome.ok) {
          logger.error('Scheduled recheck failed', { error: outcome.error, scheduleId: schedule.id })
          continue
        }

        schedule.lastRunAt = new Date().toISOString()
        schedule.nextRunAt = calcNextRun(schedule.interval).toISOString()
        await redis.hset(SCHEDULES_KEY, schedule.id, JSON.stringify(schedule))
        await redis.zadd(SCHEDULE_INDEX_KEY, new Date(schedule.nextRunAt).getTime(), schedule.id)

        logger.info('Scheduled recheck completed', {
          scheduleId: schedule.id,
          newAuditId: outcome.result.auditId,
          nextRunAt: schedule.nextRunAt,
        })

        processed++
      } catch (err) {
        logger.error('Error processing schedule', { scheduleId: schedule.id, error: err })
      }
    }

    await redis.quit()
    return processed
  }

  async getUserSchedules(userId: string): Promise<RecheckSchedule[]> {
    const redis = await getRedis()
    const all = await redis.hvals(SCHEDULES_KEY)
    await redis.quit()
    return all
      .map((r) => JSON.parse(r) as RecheckSchedule)
      .filter((s) => s.userId === userId && s.isActive)
  }

  async cancelSchedule(scheduleId: string): Promise<void> {
    const redis = await getRedis()
    const raw = await redis.hget(SCHEDULES_KEY, scheduleId)
    if (raw) {
      const schedule = JSON.parse(raw) as RecheckSchedule
      schedule.isActive = false
      await redis.hset(SCHEDULES_KEY, scheduleId, JSON.stringify(schedule))
      await redis.zrem(SCHEDULE_INDEX_KEY, scheduleId)
    }
    await redis.quit()
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    const redis = await getRedis()
    await redis.hdel(SCHEDULES_KEY, scheduleId)
    await redis.zrem(SCHEDULE_INDEX_KEY, scheduleId)
    await redis.quit()
  }
}

export const recheckScheduler = new RecheckScheduler()