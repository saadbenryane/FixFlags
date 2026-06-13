import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { handleRouteError } from '@/lib/api/errors'

const STUCK_MINUTES = 15

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cutoff = new Date(Date.now() - STUCK_MINUTES * 60 * 1000)
    const stuckAudits = await prisma.audit.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'FAILED'] },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, status: true },
    })

    let requeued = 0
    let failed = 0

    for (const audit of stuckAudits) {
      const existingJob = await getAuditQueue().getJob(audit.id)
      if (existingJob && ['waiting', 'active', 'delayed'].includes(await existingJob.getState())) {
        continue
      }

      if (audit.status === 'QUEUED') {
        await getAuditQueue().add('audit', { auditId: audit.id }, { jobId: audit.id })
        requeued++
      } else {
        await prisma.audit.update({
          where: { id: audit.id },
          data: {
            status: 'FAILED',
            errorMsg: 'Audit timed out — please try again',
          },
        })
        failed++
      }
    }

    return NextResponse.json({ requeued, failed, checked: stuckAudits.length })
  } catch (err) {
    return handleRouteError(err)
  }
}
