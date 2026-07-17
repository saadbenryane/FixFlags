import { ImageResponse } from 'next/og'
import { prisma } from '@/lib/db'
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
      verdict: true,
      status: true,
      isPublic: true,
      userId: true,
      rubrics: {
        select: {
          name: true,
          grade: true,
          score: true,
          flags: {
            select: { severity: true, problem: true },
            orderBy: { position: 'asc' },
            take: 3,
          },
        },
      },
    },
  })

  const isShareableOg = audit?.isPublic || audit?.userId === null
  if (!audit || audit.status !== 'COMPLETED' || !isShareableOg) {
    return new ImageResponse(<ReportOgImage mode="light" generic />, { ...size })
  }

  const hostname = audit.url ? displayHostname(audit.url) : 'yoursite.com'

  const score = audit.score ?? null
  const topIssue =
    audit.rubrics
      ?.flatMap((r) => r.flags)
      .find((f) => f.severity === 'IMPORTANT' || f.severity === 'CRITICAL')?.problem ??
    audit.verdict?.slice(0, 80) ??
    'Automated QA report'

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
