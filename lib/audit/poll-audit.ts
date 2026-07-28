import { prisma } from '@/lib/db'
import { recoverAuditJobOnPoll } from '@/lib/audit/recover-audit-job'

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
      select: { status: true, updatedAt: true, startedAt: true, createdAt: true },
    })

    if (audit && !TERMINAL_STATUSES.has(audit.status)) {
      await recoverAuditJobOnPoll(auditId, audit)
    }

    const latest = await prisma.audit.findUnique({
      where: { id: auditId },
      select: { status: true },
    })

    if (latest && TERMINAL_STATUSES.has(latest.status)) {
      return { status: latest.status, timedOut: false }
    }

    await sleep(intervalMs, signal)
  }

  const final = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { status: true },
  })
  return { status: final?.status ?? 'QUEUED', timedOut: true }
}
