import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canAccessAudit } from '@/lib/audit/access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { markAnonymousAuditCompletedOnce } from '@/lib/audit/usage'
import {
  deriveScreenshotCaptureStatus,
  parseScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { parsePipelineLog } from '@/lib/audit/pipeline-log'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { getAuditQueueInfo } from '@/lib/queue/estimate'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await resolveSessionUser()

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: {
        status: true,
        progress: true,
        errorMsg: true,
        failureCode: true,
        failureStage: true,
        failureMetadata: true,
        pipelineVersion: true,
        pipelineLog: true,
        reportCompleteness: true,
        startedAt: true,
        completedAt: true,
        url: true,
        userId: true,
        isPublic: true,
        parentId: true,
        performanceData: true,
        screenshots: {
          select: { device: true, url: true, width: true, height: true },
        },
        areas: {
          select: { name: true, grade: true, score: true },
          orderBy: { name: 'asc' },
        },
        findings: {
          select: { id: true, severity: true, problem: true, area: true },
          orderBy: { position: 'asc' },
          take: 20,
        },
      },
    })

    if (!audit) {
      return apiError('Audit not found', 404)
    }

    if (!canAccessAudit(audit, session?.user)) {
      return apiError('You do not have access to this audit', 403)
    }

    if (!audit.userId && audit.status === 'COMPLETED') {
      await markAnonymousAuditCompletedOnce(id)
    }

    const storedCapture = parseScreenshotCaptureStatus(audit.performanceData)
    const screenshotCapture = deriveScreenshotCaptureStatus(
      audit.status,
      audit.screenshots,
      storedCapture
    )

    const pipelineLog = parsePipelineLog(audit.pipelineLog)
    const findingsCount = await prisma.finding.count({ where: { auditId: id } })

    let queueInfo = null
    if (audit.status === 'QUEUED') {
      queueInfo = await getAuditQueueInfo(id)
    }

    const { performanceData: _pd, pipelineLog: _pl, findings: partialFindings, ...rest } = audit

    return NextResponse.json({
      ...rest,
      screenshotCapture,
      pipelineVersion: audit.pipelineVersion ?? PIPELINE_VERSION,
      pipelineLog: pipelineLog.slice(-30),
      findingsCount,
      queuePosition: queueInfo?.queuePosition,
      estimatedWaitSeconds: queueInfo?.estimatedWaitSeconds,
      scheduledStartAt: queueInfo?.scheduledStartAt,
      queueReason: queueInfo?.isDelayed ? 'rate_limit' : queueInfo ? 'backlog' : undefined,
      partialFindings:
        audit.status === 'CHECKING' || audit.status === 'JUDGING' ? partialFindings : undefined,
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
