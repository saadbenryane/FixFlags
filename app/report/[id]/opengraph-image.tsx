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

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const audit = await prisma.audit.findUnique({
    where: { id },
    select: {
      url: true,
      score: true,
      status: true,
      isPublic: true,
      userId: true,
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
  })

  if (!audit || audit.status !== 'COMPLETED' || !audit.isPublic) {
    return new ImageResponse(<ReportOgImage mode="light" generic />, { ...size })
  }

  const hostname = audit.url ? displayHostname(audit.url) : 'yoursite.com'

  const score = audit.score ?? null
  const topIssue = recordedPrioritySummary(audit.rubrics.flatMap(r => r.flags))

  const rubrics = computeRubricsFromRows(
    audit.rubrics.map((r) => ({
      name: r.name,
      grade: r.grade,
      score: r.score,
      flags: r.flags.map((f) => ({ severity: f.severity })),
    }))
  )

  return new ImageResponse(
    (
      <ReportOgImage
        mode="light"
        hostname={hostname}
        topIssue={topIssue}
        score={score}
        rubrics={rubrics.map((r) => ({ name: r.name, status: r.status }))}
      />
    ),
    { ...size }
  )
}
