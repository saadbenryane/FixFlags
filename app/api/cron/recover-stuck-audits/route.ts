import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { STUCK_AUDIT_MINUTES } from '@/lib/audit/pipeline-config'
import { recoverStuckAuditOnCron } from '@/lib/audit/recover-audit-job'
import { stuckAuditCutoff } from '@/lib/audit/stuck-audit-recovery'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return apiError('Unauthorized', 401, { code: 'UNAUTHORIZED' })
  }

  try {
    const cutoff = stuckAuditCutoff(Date.now(), STUCK_AUDIT_MINUTES)
    const stuckAudits = await prisma.audit.findMany({
      where: {
        status: { notIn: ['COMPLETED', 'FAILED'] },
        updatedAt: { lt: cutoff },
      },
      select: { id: true, status: true, startedAt: true },
    })

    let requeued = 0
    let failed = 0

    for (const audit of stuckAudits) {
      const result = await recoverStuckAuditOnCron(audit.id, audit)
      if (result === 'requeued') requeued++
      if (result === 'force_failed') failed++
    }

    return NextResponse.json({ requeued, failed, checked: stuckAudits.length })
  } catch (err) {
    return handleRouteError(err)
  }
}
