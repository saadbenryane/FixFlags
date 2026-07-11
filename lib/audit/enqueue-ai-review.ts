import { getAuditQueue } from '@/lib/queue/client'

export async function enqueueAiReview(auditId: string, delayMs = 0): Promise<void> {
  await getAuditQueue().add(
    'ai-review',
    { auditId },
    {
      jobId: `ai-review-${auditId}`,
      attempts: 2,
      backoff: { type: 'fixed', delay: 30_000 },
      delay: delayMs,
      removeOnComplete: 100,
      removeOnFail: 500,
    }
  )
}
