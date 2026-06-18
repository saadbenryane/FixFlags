import { getAuditQueue } from '@/lib/queue/client'

export async function enqueueAiReview(auditId: string): Promise<void> {
  await getAuditQueue().add(
    'ai-review',
    { auditId },
    {
      jobId: `ai-review-${auditId}`,
      removeOnComplete: 100,
      removeOnFail: 500,
    }
  )
}
