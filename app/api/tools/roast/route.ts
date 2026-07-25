import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { auth } from '@/lib/auth'
import {
  AuditLimitError,
  createAndEnqueueAudit,
} from '@/lib/audit/create-audit'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { prisma } from '@/lib/db'
import { buildAttribution } from '@/lib/leads/attribution'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { ROAST_COPY } from '@/lib/marketing/copy'
import { gradeFromScore } from '@/lib/audit/scoring'
import { generateBadgeSvg, hostnameFromUrl } from '@/lib/design/badge-svg'

interface RoastResult {
  url: string
  auditId: string
  reportUrl: string
  overallGrade: string
  overallScore: number
  tagline: string
  rubrics: {
    name: string
    score: number
    grade: string
    verdict: string
  }[]
  topIssues: {
    severity: string
    problem: string
    rubric: string
  }[]
  badgeSvg: string
}

function taglineFromGrade(grade: string): string {
  const key = grade as keyof typeof ROAST_COPY.taglines
  if (key in ROAST_COPY.taglines && key !== 'default') {
    return ROAST_COPY.taglines[key]
  }
  return ROAST_COPY.taglines.default
}

function rubricVerdict(name: string, score: number): string {
  const grade = gradeFromScore(score)
  const byRubric = ROAST_COPY.rubricVerdicts[name as keyof typeof ROAST_COPY.rubricVerdicts]
  return byRubric?.[grade] || 'Checked.'
}

const POLL_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 3_000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const rawUrl = typeof body.url === 'string' ? body.url : ''
    if (!rawUrl) {
      return apiError('URL is required', 400)
    }

    const urlResult = normalizeAuditUrl(rawUrl)
    if (!urlResult.ok) {
      return apiError(urlResult.error, 400)
    }
    const { url } = urlResult

    const session = await auth.api.getSession({ headers: await headers() }).catch(() => null)
    const clientId = requestClientId(req.headers)

    await enforceRateLimit({
      scope: session?.user ? 'audit-user-hard' : 'audit-client-hard',
      identifier: session?.user?.id ?? clientId,
      limit: session?.user ? 120 : 60,
      windowSeconds: 3600,
    })

    const attribution = buildAttribution({
      url,
      source: 'TOOL_PAGE',
      pathname: '/roast',
      referer: req.headers.get('referer'),
      searchParams: req.nextUrl.searchParams,
    })

    const { auditId } = await createAndEnqueueAudit({
      url,
      userId: session?.user?.id ?? null,
      auditMode: 'SINGLE',
      monitoringMode: 'FULL',
      attribution,
      clientId: session?.user ? undefined : clientId,
    })

    const startedAt = Date.now()
    let status = 'QUEUED'
    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
      const row = await prisma.audit.findUnique({
        where: { id: auditId },
        select: { status: true },
      })
      status = row?.status ?? status
      if (status === 'COMPLETED' || status === 'FAILED') break
    }

    if (status === 'FAILED') {
      return apiError('Audit failed', 500)
    }
    if (status !== 'COMPLETED') {
      return NextResponse.json(
        {
          code: 'HTTP_504',
          message: 'Roast timed out. Open the report to continue waiting.',
          auditId,
          reportUrl: `/report/${auditId}`,
        },
        { status: 504 }
      )
    }

    const audit = await prisma.audit.findUnique({
      where: { id: auditId },
      select: {
        url: true,
        rubrics: { select: { name: true, score: true, grade: true } },
        flags: {
          select: { severity: true, problem: true, rubric: true },
          orderBy: { severity: 'asc' },
          take: 5,
        },
      },
    })

    if (!audit) {
      return apiError('Report not found', 404)
    }

    const rubrics = audit.rubrics.map((r) => ({
      name: r.name,
      score: r.score ?? 0,
      grade: r.grade ?? gradeFromScore(r.score ?? 0),
      verdict: rubricVerdict(r.name, r.score ?? 0),
    }))

    const overallScore =
      rubrics.length > 0
        ? Math.round(rubrics.reduce((sum, r) => sum + r.score, 0) / rubrics.length)
        : 0
    const overallGrade = gradeFromScore(overallScore)

    const severityOrder = { CRITICAL: 0, IMPORTANT: 1, POLISH: 2 } as const
    const topIssues = [...audit.flags].sort(
      (a, b) =>
        (severityOrder[a.severity as keyof typeof severityOrder] ?? 3) -
        (severityOrder[b.severity as keyof typeof severityOrder] ?? 3)
    )

    const result: RoastResult = {
      url: audit.url,
      auditId,
      reportUrl: `/report/${auditId}`,
      overallGrade,
      overallScore,
      tagline: taglineFromGrade(overallGrade),
      rubrics,
      topIssues,
      badgeSvg: generateBadgeSvg(overallGrade, overallScore, hostnameFromUrl(audit.url)),
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AuditLimitError) {
      return apiError(err.message, 402, { code: err.code, action: err.action })
    }
    return handleRouteError(err)
  }
}
