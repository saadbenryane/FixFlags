import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { normalizeDomain } from '@/lib/leads/normalize-domain'
import { normalizeAuditUrl } from '@/lib/audit/url'

function gradeFromScore(score: number): string {
  if (score >= 90) return 'A'
  if (score >= 80) return 'B'
  if (score >= 65) return 'C'
  if (score >= 50) return 'D'
  return 'F'
}

/** SVG-only hex island (badge artwork). */
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

function generateBadgeSvg(
  grade: string,
  score: number,
  displayHost: string,
  color: string
): string {
  const hostname = displayHost.slice(0, 40)

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

  const audit = domain
    ? await prisma.audit.findFirst({
        where: {
          status: 'COMPLETED',
          OR: [
            { normalizedDomain: domain },
            { url: { contains: domain } },
          ],
        },
        orderBy: { completedAt: 'desc' },
        include: {
          rubrics: { select: { score: true } },
        },
      })
    : null

  const displayHost = (() => {
    try {
      return new URL(lookupUrl).hostname.replace(/^www\./, '')
    } catch {
      return domain || decoded.slice(0, 30)
    }
  })()

  if (!audit) {
    return new Response(generateBadgeSvg('?', 0, displayHost, '#6b7280'), {
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
  const color = gradeColor(grade)

  return new Response(generateBadgeSvg(grade, overallScore, displayHost, color), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
