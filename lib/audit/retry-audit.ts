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

  const queue = getAuditQueue()
  const existingJob = await queue.getJob(auditId)
  if (existingJob) {
    const state = await existingJob.getState()
    if (state === 'active' || state === 'waiting' || state === 'delayed') {
      throw new Error('Audit is already running')
    }
    await existingJob.remove()
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: {
      status: 'QUEUED',
      progress: 5,
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

export async function retryAuditSummary(auditId: string): Promise<{ status: string }> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { id: true, status: true, parentId: true },
  })
  if (!audit) throw new Error('Audit not found')
  if (audit.status !== 'FAILED' && audit.status !== 'COMPLETED') {
    throw new Error('Can only retry summary on terminal audits')
  }

  await prisma.audit.update({
    where: { id: auditId },
    data: { recheckMode: 'SUMMARY_ONLY' },
  })

  return retryAudit(auditId)
}
