import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { sendNurtureEmail } from '@/lib/email/send'

const CRON_SECRET = process.env.CRON_SECRET

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000)
  const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)

  const recheckCandidates = await prisma.user.findMany({
    where: {
      plan: 'FREE',
      createdAt: { lte: twoDaysAgo, gte: threeDaysAgo },
    },
    select: { id: true },
  })

  const launchCandidates = await prisma.user.findMany({
    where: {
      plan: 'FREE',
      createdAt: { lte: fiveDaysAgo, gte: sixDaysAgo },
    },
    select: { id: true },
  })

  const results = { recheck: 0, launchChecklist: 0, skipped: 0 }

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

  return NextResponse.json(results)
}
