import { NextRequest, NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { prisma } from '@/lib/db'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { resolveAuditAccess } from '@/lib/audit/access'
import { SHARE_GRANT_COOKIE } from '@/lib/security/share-grant'
import { resolveSessionUser } from '@/lib/audit/fetch-audit'
import { deriveScreenshotCaptureStatus,
  parseScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { PIPELINE_VERSION } from '@/lib/audit/pipeline-config'
import { computeShareStatusFromRubrics } from '@/lib/audit/rubric'
import { recoverAuditJobOnPoll } from '@/lib/audit/recover-audit-job'
import { recordRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { parseActionTimeline } from '@/lib/audit/action-timeline'
import { parseProductContract } from '@/lib/audit/product-contract'
import { loadTechnologyProfile } from '@/lib/audit/technology-profile'
import { progressiveAuditSelect } from '@/lib/audit/fetch-audit'

const NON_TERMINAL = new Set(['QUEUED', 'CAPTURING', 'CHECKING', 'JUDGING', 'FINALIZING'])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await resolveSessionUser()

    const clientId = requestClientId(await headers())
    await recordRateLimit({ scope: 'report-status', identifier: clientId, limit: 60, windowSeconds: 60 })

    const audit = await prisma.audit.findUnique({
      where: { id },
      select: progressiveAuditSelect,
    })

    if (!audit) {
      return apiError('Report not found', 404)
    }

    const access = await resolveAuditAccess(
      audit,
      session?.user,
      (await cookies()).get(SHARE_GRANT_COOKIE)?.value
    )
    if (access === 'denied') {
      return apiError('You do not have access to this report', 403)
    }

    if (NON_TERMINAL.has(audit.status)) {
      const secondsSinceUpdate = (Date.now() - audit.updatedAt.getTime()) / 1000
      if (secondsSinceUpdate > 15) {
        await recoverAuditJobOnPoll(id, audit)
      }
    }

    const refreshed = NON_TERMINAL.has(audit.status)
      ? await prisma.audit.findUnique({
          where: { id },
          select: {
            status: true,
            errorMsg: true,
            failureCode: true,
          },
        })
      : null

    const effectiveStatus = refreshed?.status ?? audit.status

    const storedCapture = parseScreenshotCaptureStatus(audit.performanceData)
    const screenshotCapture = deriveScreenshotCaptureStatus(
      effectiveStatus,
      audit.screenshots,
      storedCapture
    )

    const showPartialFlags =
      effectiveStatus === 'CHECKING' ||
      effectiveStatus === 'JUDGING' ||
      effectiveStatus === 'FINALIZING' ||
      // Keep flags on COMPLETED so the progressive hold frame does not blank before SSR swap.
      effectiveStatus === 'COMPLETED'

    const isTerminal = effectiveStatus === 'COMPLETED' || effectiveStatus === 'FAILED'

    // Skip heavy computations during scanning to keep the status endpoint fast
    // and avoid starving the event loop.
    const flagCount = isTerminal
      ? await prisma.flag.count({ where: { auditId: id } })
      : audit.flags.length

    const rubricSources = isTerminal
      ? audit.rubrics.map((r) => ({
          name: r.name,
          grade: r.grade,
          score: r.score,
          flags: audit.flags.filter((f) => f.rubric === r.name).map((f) => ({ severity: f.severity })),
        }))
      : []
    const flatFlags = isTerminal
      ? audit.flags.map((f) => ({ severity: f.severity, rubric: f.rubric }))
      : []
    const shareStatus = isTerminal
      ? computeShareStatusFromRubrics(rubricSources, flatFlags)
      : 'private'

    const { flags: partialFlags, performanceData, productContract, ...rest } = audit
    // Timeline + contract are lightweight JSON parses; stream them during CHECKING
    // so progressive report chrome stays honest. Technology profile stays terminal-only.
    const actionTimeline = parseActionTimeline(performanceData)
    const contract = parseProductContract(productContract)
    const technologyProfile = isTerminal
      ? await loadTechnologyProfile(id, {
          score: audit.score,
          rubrics: audit.rubrics.map((rubric) => ({
            name: rubric.name,
            score: rubric.score,
          })),
          flags: audit.flags.map((flag) => ({ rubric: flag.rubric })),
        })
      : undefined

    return NextResponse.json({
      ...rest,
      status: effectiveStatus,
      errorMsg: refreshed?.errorMsg ?? audit.errorMsg,
      failureCode: refreshed?.failureCode ?? audit.failureCode,
      screenshotCapture,
      pipelineVersion: audit.pipelineVersion ?? PIPELINE_VERSION,
      flagCount,
      shareStatus,
      partialFlags: showPartialFlags ? partialFlags : undefined,
      actionTimeline,
      productContract: contract,
      technologyProfile,
    })
  } catch (err) {
    return handleRouteError(err)
  }
}
