import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { STUCK_AUDIT_MINUTES } from '@/lib/audit/pipeline-config'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })
  }

  try {
    const cutoff = new Date(Date.now() - STUCK_AUDIT_MINUTES * 60 * 1000)
    const stuckAudits = await prisma.audit.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'FAILED'] },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, status: true },
    })

    let requeued = 0
    let failed = 0
    const queue = getAuditQueue()

    for (const audit of stuckAudits) {
      const existingJob = await queue.getJob(audit.id)
      const jobState = existingJob ? await existingJob.getState() : null

      if (existingJob && jobState === 'active') {
        await existingJob.moveToFailed(
          new Error('Audit timed out — force failed by recovery cron'),
          '0',
          true
        )
        await logPipelineEvent(audit.id, {
          stage: audit.status.toLowerCase(),
          event: 'cron_force_failed',
          error: 'Audit timed out — please try again',
        })
        await prisma.audit.update({
          where: { id: audit.id },
          data: {
            status: 'FAILED',
            errorMsg: 'Audit timed out — please try again',
            failureCode: 'AUDIT_TIMEOUT',
            failureStage: audit.status.toLowerCase(),
            failureMetadata: { jobId: audit.id, source: 'cron' },
          },
        })
        failed++
        continue
      }

      if (existingJob && ['waiting', 'delayed'].includes(jobState ?? '')) {
        await existingJob.remove()
      }

      if (audit.status === 'QUEUED') {
        await queue.add('audit', { auditId: audit.id }, { jobId: audit.id, attempts: 1 })
        requeued++
      } else {
        await logPipelineEvent(audit.id, {
          stage: audit.status.toLowerCase(),
          event: 'cron_force_failed',
          error: 'Audit timed out — please try again',
        })
        await prisma.audit.update({
          where: { id: audit.id },
          data: {
            status: 'FAILED',
            errorMsg: 'Audit timed out — please try again',
            failureCode: 'AUDIT_TIMEOUT',
            failureStage: audit.status.toLowerCase(),
            failureMetadata: { jobId: audit.id, source: 'cron' },
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
