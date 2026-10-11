import { prisma } from '@/lib/db'

const TERMINAL_STATUSES = new Set(['COMPLETED', 'FAILED'])

export interface PollAuditOptions {
  auditId: string
  timeoutMs?: number
  intervalMs?: number
  signal?: AbortSignal
}

import { sleep } from '@/lib/utils/sleep'

/** Poll until audit reaches a terminal status or timeout/abort. */
export async function pollAuditUntilDone(options: PollAuditOptions): Promise<{
  status: string
  timedOut: boolean
}> {
  const { auditId, timeoutMs = 90_000, intervalMs = 3_000, signal } = options
  const start = Date.now()

  while (Date.now() - start < timeoutMs && !signal?.aborted) {
    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { status: true, updatedAt: true, startedAt: true, createdAt: true, reviewDepth: true },
    })

    if (audit && TERMINAL_STATUSES.has(audit.status)) {
      return { status: audit.status, timedOut: false }
    }

    await sleep(intervalMs, signal)
  }

  const final = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { status: true },
  })
  return { status: final?.status ?? 'QUEUED', timedOut: true }
}
