import { prisma } from '@/lib/db'
import { getAuditQueue } from '@/lib/queue/client'
import { AuditStatus } from '@prisma/client'

export interface CreateAuditOptions {
  url: string
  userId?: string | null
  parentId?: string
}

export interface CreateAuditResult {
  auditId: string
  status: AuditStatus
}

export async function createAndEnqueueAudit(
  options: CreateAuditOptions
): Promise<CreateAuditResult> {
  const audit = await prisma.audit.create({
    data: {
      url: options.url,
      userId: options.userId ?? null,
      parentId: options.parentId ?? null,
      status: 'QUEUED',
      progress: 5,
    },
  })

  try {
    await getAuditQueue().add('audit', { auditId: audit.id }, { jobId: audit.id })
  } catch (err) {
    await prisma.audit.update({
      where: { id: audit.id },
      data: { status: 'FAILED', errorMsg: 'Failed to enqueue audit job' },
    })
    throw err
  }

  return { auditId: audit.id, status: 'QUEUED' }
}
