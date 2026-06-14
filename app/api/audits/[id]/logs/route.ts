import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { canAccessAudit } from '@/lib/audit/access'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { parsePipelineLog } from '@/lib/audit/pipeline-log'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { isAdminUser } from '@/lib/auth/permissions'

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
        id: true,
        url: true,
        status: true,
        userId: true,
        isPublic: true,
        startedAt: true,
        completedAt: true,
        errorMsg: true,
        failureCode: true,
        failureStage: true,
        failureMetadata: true,
        pipelineVersion: true,
        pipelineLog: true,
        runCost: {
          select: {
            durationMs: true,
            llmInputTokens: true,
            llmOutputTokens: true,
            llmModel: true,
            estimatedCostUsd: true,
            pagespeedCalls: true,
          },
        },
      },
    })
    if (!audit) return apiError('Audit not found', 404)

    if (!canAccessAudit(audit, session?.user)) {
      const isAdmin = session?.user && isAdminUser(session.user)
      if (!isAdmin) {
        return apiError('You do not have access to this audit', 403)
      }
    }

    const log = {
      auditId: audit.id,
      jobId: audit.id,
      url: audit.url,
      status: audit.status,
      pipelineVersion: audit.pipelineVersion ?? PIPELINE_VERSION,
      startedAt: audit.startedAt?.toISOString() ?? null,
      completedAt: audit.completedAt?.toISOString() ?? null,
      errorMsg: audit.errorMsg,
      failureCode: audit.failureCode,
      failureStage: audit.failureStage,
      failureMetadata: audit.failureMetadata,
      events: parsePipelineLog(audit.pipelineLog),
      cost: audit.runCost,
    }

    return new NextResponse(JSON.stringify(log, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="audit-${audit.id}-logs.json"`,
      },
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
