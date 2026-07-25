import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeDomain } from '@/lib/leads/normalize-domain'
import { normalizeAuditUrl } from '@/lib/audit/url'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { gradeFromScore } from '@/lib/audit/scoring'
import { generateBadgeSvg } from '@/lib/design/badge-svg'
import { handleRouteError } from '@/lib/api/errors'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ url: string }> }
) {
  const { url: rawParam } = await params
  const decoded = decodeURIComponent(rawParam || '').trim()
  if (!decoded) {
    return new Response('URL required', { status: 400 })
  }

  const withProtocol = /^https?:\/\//i.test(decoded) ? decoded : `https://${decoded}`
  const urlResult = normalizeAuditUrl(withProtocol)
  const lookupUrl = urlResult.ok ? urlResult.url : withProtocol
  const domain = normalizeDomain(lookupUrl) || normalizeDomain(decoded)

  if (!domain) {
    return new Response(generateBadgeSvg('?', 0, decoded.slice(0, 30)), {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' },
    })
  }

  const clientId = requestClientId(_req.headers)
  try {
    await enforceRateLimit({ scope: 'badge', identifier: clientId, limit: 30, windowSeconds: 60 })
  } catch (error) {
    return handleRouteError(error, 'Failed to load badge')
  }

  const audit = await prisma.audit.findFirst({
    where: {
      status: 'COMPLETED',
      normalizedDomain: domain,
    },
    orderBy: { completedAt: 'desc' },
    include: {
      rubrics: { select: { score: true } },
    },
  })

  const displayHost = (() => {
    try {
      return new URL(lookupUrl).hostname.replace(/^www\./, '')
    } catch {
      return domain || decoded.slice(0, 30)
    }
  })()

  if (!audit) {
    return new Response(generateBadgeSvg('?', 0, displayHost), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  const scores = audit.rubrics
    .map((r) => r.score)
    .filter((s): s is number => s !== null)

  const overallScore = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0
  const grade = gradeFromScore(overallScore)

  return new Response(generateBadgeSvg(grade, overallScore, displayHost), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
