import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/db'
import { REPORT_FINDING_POLICY_SELECT, recordedPrioritySummary } from '@/lib/report/finding-presentation'
import { computeRubricsFromRows } from '@/lib/audit/rubric'
import { ReportOgImage } from '@/lib/design/og-templates'
import { displayHostname } from '@/lib/utils/url-helpers'

export const runtime = 'nodejs'
export const alt = 'FixFlags report'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const link = await prisma.shareLink.findUnique({
    where: { token },
    select: {
      revoked: true,
      expiresAt: true,
      maxViews: true,
      viewCount: true,
      passwordHash: true,
      audit: {
        select: {
          url: true,
          score: true,
          status: true,
          isPublic: true,
          rubrics: {
            select: {
              name: true,
              grade: true,
              score: true,
              flags: {
                select: REPORT_FINDING_POLICY_SELECT,
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      },
    },
  })

  const valid =
    link &&
    !link.revoked &&
    !link.passwordHash &&
    link.audit.status === 'COMPLETED' &&
    (!link.expiresAt || link.expiresAt >= new Date()) &&
    (!link.maxViews || link.viewCount < link.maxViews)

  if (!valid) {
    return new ImageResponse(<ReportOgImage mode="light" generic />, { ...size })
  }

  const hostname = link.audit.url ? displayHostname(link.audit.url) : 'yoursite.com'

  const score = link.audit.score ?? null
  const topIssue = recordedPrioritySummary(link.audit.rubrics.flatMap(r => r.flags))

  const rubrics = computeRubricsFromRows(
    link.audit.rubrics.map((r) => ({
      name: r.name,
      grade: r.grade,
      score: r.score,
      flags: r.flags.map((f) => ({ severity: f.severity })),
    }))
  )

  return new ImageResponse(
    <ReportOgImage
      mode="light"
      hostname={hostname}
      topIssue={topIssue}
      score={score}
      rubrics={rubrics.map((r) => ({ name: r.name, status: r.status }))}
    />,
    { ...size }
  )
}
