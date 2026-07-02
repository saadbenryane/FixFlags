import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'

export async function retryAudit(auditId: string): Promise<{ status: string }> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { id: true, status: true, url: true },
  })
  if (!audit) throw new Error('Audit not found')
  if (audit.status !== 'FAILED' && audit.status !== 'COMPLETED') {
    throw new Error('Can only retry failed or completed audits for summary refresh')
  }

  // The audit's DB status is already terminal (FAILED/COMPLETED - guarded
  // above). Any job still in the queue is therefore stale (e.g. a run that blew
  // the deadline and was force-failed while its job lingered active). Clear it
  // unconditionally so retry never dead-ends on "Audit is already running".
  const queue = getAuditQueue()
  const existingJob = await queue.getJob(auditId)
  if (existingJob) {
    const state = await existingJob.getState()
    if (state === 'active') {
      await existingJob.moveToFailed(new Error('Superseded by retry'), '0', true)
    }
    try {
      await existingJob.remove()
    } catch {
      // Job may have been picked up or removed between checks.
    }
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: 'QUEUED',
      progress: 5,
      startedAt: null,
      errorMsg: null,
      failureCode: null,
      failureStage: null,
      failureMetadata: undefined,
      completedAt: null,
      finalizedAt: null,
      pipelineLog: [],
    },
  })

  await queue.add('audit', { auditId }, {
    jobId: auditId,
    attempts: 1,
    removeOnComplete: 100,
    removeOnFail: 500,
  })

  return { status: 'QUEUED' }
}
