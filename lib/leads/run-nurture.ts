import { prisma } from '@/lib/db'
import { sendNurtureEmail } from '@/lib/email/send'

export interface NurtureSweepResult {
  firstAuditNudge: number
  recheck: number
  launchChecklist: number
  skipped: number
}

/**
 * Send time-based nurture emails to free users. Single source of truth shared
 * by the HTTP endpoint (/api/cron/nurture) and the internal scheduler.
 * sendNurtureEmail de-duplicates per user/type, so re-running is safe.
 */
export async function runNurtureSweep(): Promise<NurtureSweepResult> {
  const now = Date.now()
  const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000)
  const twoDaysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000)
  const fiveDaysAgo = new Date(now - 5 * 24 * 60 * 60 * 1000)
  const sixDaysAgo = new Date(now - 6 * 24 * 60 * 60 * 1000)

  // 24h nudge: signed up yesterday, has not run a single audit yet
  const firstAuditNudgeCandidates = await prisma.user.findMany({
    where: {
      plan: 'FREE',
      createdAt: { lte: oneDayAgo, gte: twoDaysAgo },
      audits: { none: {} },
    },
    select: { id: true },
  })

  // 2-day recheck nudge: signed up 2-3 days ago
  const recheckCandidates = await prisma.user.findMany({
    where: {
      plan: 'FREE',
      createdAt: { lte: twoDaysAgo, gte: threeDaysAgo },
    },
    select: { id: true },
  })

  // 5-day launch checklist nudge
  const launchCandidates = await prisma.user.findMany({
    where: {
      plan: 'FREE',
      createdAt: { lte: fiveDaysAgo, gte: sixDaysAgo },
    },
    select: { id: true },
  })

  const results: NurtureSweepResult = {
    firstAuditNudge: 0,
    recheck: 0,
    launchChecklist: 0,
    skipped: 0,
  }

  for (const user of firstAuditNudgeCandidates) {
    const { sent } = await sendNurtureEmail(user.id, 'firstAuditNudge')
    if (sent) results.firstAuditNudge++
    else results.skipped++
  }

  for (const user of recheckCandidates) {
    const { sent } = await sendNurtureEmail(user.id, 'recheck')
    if (sent) results.recheck++
    else results.skipped++
  }

  for (const user of launchCandidates) {
    const { sent } = await sendNurtureEmail(user.id, 'launchChecklist')
    if (sent) results.launchChecklist++
    else results.skipped++
  }

  return results
}
