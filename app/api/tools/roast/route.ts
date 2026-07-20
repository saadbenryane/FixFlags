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

/** SVG-only hex island (badge artwork). Prefer grade tokens conceptually. */
function gradeColor(grade: string): string {
  switch (grade) {
    case 'A':
      return '#22c55e'
    case 'B':
      return '#84cc16'
    case 'C':
      return '#eab308'
    case 'D':
      return '#f97316'
    case 'F':
      return '#ef4444'
    default:
      return '#6b7280'
  }
}

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 65) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

function taglineFromGrade(grade: string): string {
  const key = grade as keyof typeof ROAST_COPY.taglines
  if (key in ROAST_COPY.taglines && key !== 'default') {
    return ROAST_COPY.taglines[key]
  }
  return ROAST_COPY.taglines.default
}

function rubricVerdict(name: string, score: number): string {
  const grade = gradeFromScore(score) as 'A' | 'B' | 'C' | 'D' | 'F'
  const byRubric = ROAST_COPY.rubricVerdicts[name as keyof typeof ROAST_COPY.rubricVerdicts]
  return byRubric?.[grade] || 'Checked.'
}

function generateBadgeSvg(grade: string, score: number, url: string): string {
  const color = gradeColor(grade)
  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return url
    }
  })()

  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0f172a"/>
      <stop offset="100%" style="stop-color:#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="320" height="180" rx="16" fill="url(#bg)"/>
  <rect x="1" y="1" width="318" height="178" rx="15" fill="none" stroke="${color}" stroke-width="2" stroke-opacity="0.4"/>
  <text x="24" y="48" font-family="system-ui,-apple-system,sans-serif" font-size="13" font-weight="600" fill="${color}" letter-spacing="0.5">FIXFLAGS</text>
  <text x="24" y="80" font-family="system-ui,-apple-system,sans-serif" font-size="24" font-weight="700" fill="white">Quality Grade</text>
  <text x="24" y="115" font-family="ui-monospace,monospace" font-size="48" font-weight="800" fill="${color}">${grade}</text>
  <text x="82" y="115" font-family="system-ui,-apple-system,sans-serif" font-size="16" fill="#94a3b8">${score}/100</text>
  <text x="24" y="152" font-family="system-ui,-apple-system,sans-serif" font-size="12" fill="#64748b">${hostname}</text>
</svg>`
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
      badgeSvg: generateBadgeSvg(overallGrade, overallScore, audit.url),
    }

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AuditLimitError) {
      return apiError(err.message, 402, { code: err.code, action: err.action })
    }
    return handleRouteError(err)
  }
}
