import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleRouteError, apiError } from '@/lib/api/errors'
import { AuditLimitError, createAndEnqueueAudit } from '@/lib/audit/create-audit'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { enforceRateLimit, recordRateLimit } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/db'

const querySchema = z.object({
  url: z.string().url('Invalid URL, include https://'),
})

const POLL_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 1_500

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || req.headers.get('x-real-ip') || 'unknown'
}

export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req)
    await enforceRateLimit({
      scope: 'score-api',
      identifier: ip,
      limit: 100,
      windowSeconds: 60,
    })

    const { searchParams } = new URL(req.url)
    const parsed = querySchema.safeParse({ url: searchParams.get('url') })
    if (!parsed.success) {
      return apiError(parsed.error.issues[0]?.message ?? 'Invalid URL', 400)
    }

    const urlResult = normalizeAuditUrl(parsed.data.url)
    if (!urlResult.ok) {
      return apiError(urlResult.error, 400)
    }
    const normalizedUrl = urlResult.url

    const { auditId } = await createAndEnqueueAudit({
      url: normalizedUrl,
      userId: null,
      auditMode: 'SINGLE',
      monitoringMode: 'FULL',
      clientId: ip,
    })

    const startedAt = Date.now()
    let lastStatus: string | null = null

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))

      const audit = await prisma.audit.findUnique({
        where: { id: auditId },
        select: {
          status: true,
          progress: true,
          score: true,
          pageType: true,
          verdict: true,
          errorMsg: true,
          failureCode: true,
          reportCompleteness: true,
          completedAt: true,
          url: true,
          rubrics: {
            select: {
              name: true,
              grade: true,
              score: true,
              status: true,
              flags: {
                select: {
                  id: true,
                  rubric: true,
                  severity: true,
                  problem: true,
                  evidence: true,
                  whyItMatters: true,
                  pageUrl: true,
                },
              },
            },
          },
        },
      })

      if (!audit) {
        return apiError('Audit not found', 500)
      }

      lastStatus = audit.status

      if (audit.status === 'FAILED') {
        return NextResponse.json(
          {
            status: 'FAILED',
            error: audit.errorMsg ?? 'Check failed',
            failureCode: audit.failureCode,
            url: audit.url,
            progress: audit.progress,
          },
          { status: 422 }
        )
      }

      if (audit.status === 'COMPLETED') {
        const rubrics = audit.rubrics.map((r) => ({
          name: r.name,
          grade: r.grade,
          score: r.score,
          status: r.status,
          flagCount: r.flags.length,
          criticalCount: r.flags.filter((f) => f.severity === 'CRITICAL').length,
          importantCount: r.flags.filter((f) => f.severity === 'IMPORTANT').length,
        }))

        const allFlags = audit.rubrics.flatMap((r) => r.flags)
        const hasCritical = allFlags.some((f) => f.severity === 'CRITICAL')
        const shareStatus = hasCritical ? 'fix_before_sharing' : 'good_to_share'

        // Anon score API: never return fix prompts (same gate as report UI).
        const topFlags = [...allFlags]
          .sort((a, b) => {
            const sev: Record<string, number> = { CRITICAL: 0, IMPORTANT: 1, POLISH: 2 }
            return (sev[a.severity] ?? 3) - (sev[b.severity] ?? 3)
          })
          .slice(0, 10)
          .map((f) => ({
            severity: f.severity,
            rubric: f.rubric,
            problem: f.problem,
            evidence: f.evidence?.slice(0, 300) ?? null,
            whyItMatters: f.whyItMatters ?? null,
          }))

        await recordRateLimit({ scope: 'score-api', identifier: ip, limit: 100, windowSeconds: 60 })

        return NextResponse.json({
          status: 'COMPLETED',
          url: audit.url,
          score: audit.score,
          verdict: audit.verdict,
          pageType: audit.pageType,
          shareStatus,
          reportCompleteness: audit.reportCompleteness,
          completedAt: audit.completedAt,
          rubrics,
          topFlags,
          totalFlagCount: allFlags.length,
        })
      }
    }

    return NextResponse.json(
      {
        status: 'TIMEOUT',
        url: normalizedUrl,
        lastStatus,
        message: 'Audit did not complete within the timeout window.',
      },
      { status: 504 }
    )
  } catch (error) {
    if (error instanceof AuditLimitError) {
      return NextResponse.json(
        { error: error.message, code: error.code, action: error.action },
        { status: 403 }
      )
    }
    return handleRouteError(error)
  }
}
