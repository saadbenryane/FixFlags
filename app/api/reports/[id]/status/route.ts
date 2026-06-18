import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canAccessAudit } from '@/lib/audit/access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import {
  deriveScreenshotCaptureStatus,
  parseScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { parsePipelineLog } from '@/lib/audit/pipeline-log'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { getAuditQueueInfo } from '@/lib/queue/estimate'
import { computeShareStatusFromRubrics } from '@/lib/audit/rubric'

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
        score: true,
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
        aiReviewAt: true,
        includeAi: true,
        performanceData: true,
        screenshots: {
          select: { device: true, url: true, width: true, height: true },
        },
        rubrics: {
          select: { name: true, grade: true, score: true, status: true },
          orderBy: { name: 'asc' },
        },
        flags: {
          select: { id: true, severity: true, problem: true, rubric: true },
          orderBy: { position: 'asc' },
          take: 20,
        },
      },
    })

    if (!audit) {
      return apiError('Report not found', 404)
    }

    if (!canAccessAudit(audit, session?.user)) {
      return apiError('You do not have access to this report', 403)
    }

    const storedCapture = parseScreenshotCaptureStatus(audit.performanceData)
    const screenshotCapture = deriveScreenshotCaptureStatus(
      audit.status,
      audit.screenshots,
      storedCapture
    )

    const pipelineLog = parsePipelineLog(audit.pipelineLog)
    const flagCount = await prisma.flag.count({ where: { auditId: id } })

    const rubricSources = audit.rubrics.map((r) => ({
      name: r.name,
      grade: r.grade,
      score: r.score,
      flags: audit.flags.filter((f) => f.rubric === r.name).map((f) => ({ severity: f.severity })),
    }))
    const flatFlags = audit.flags.map((f) => ({ severity: f.severity, rubric: f.rubric }))
    const shareStatus = computeShareStatusFromRubrics(rubricSources, flatFlags)

    let queueInfo = null
    if (audit.status === 'QUEUED') {
      queueInfo = await getAuditQueueInfo(id)
    }

    const { flags: partialFlags, ...rest } = audit

    return NextResponse.json({
      ...rest,
      screenshotCapture,
      pipelineVersion: audit.pipelineVersion ?? PIPELINE_VERSION,
      pipelineLog: pipelineLog.slice(-30),
      flagCount,
      shareStatus,
      queuePosition: queueInfo?.queuePosition,
      estimatedWaitSeconds: queueInfo?.estimatedWaitSeconds,
      scheduledStartAt: queueInfo?.scheduledStartAt,
      queueReason: queueInfo?.isDelayed ? 'rate_limit' : queueInfo ? 'backlog' : undefined,
      partialFlags:
        audit.status === 'CHECKING' || audit.status === 'JUDGING' ? partialFlags : undefined,
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
