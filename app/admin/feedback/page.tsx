import { prisma } from '@/lib/db'
import { FeedbackList } from '@/components/admin/FeedbackList'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function AdminFeedbackPage() {
  const feedback = await prisma.findingFeedback.findMany({
    where: { vote: -1 },
    include: {
      finding: {
        select: {
          id: true,
          problem: true,
          checkId: true,
          area: true,
          severity: true,
          evidence: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const grouped = feedback.reduce<Record<string, { problem: string; checkId: string | null; area: string; severity: string; evidence: string; count: number }>>(
    (acc, f) => {
      const key = f.finding.checkId ?? f.finding.id
      if (!acc[key]) {
        acc[key] = {
          problem: f.finding.problem,
          checkId: f.finding.checkId,
          area: f.finding.area,
          severity: f.finding.severity,
          evidence: f.finding.evidence,
          count: 0,
        }
      }
      acc[key].count++
      return acc
    },
    {}
  )

  const items = Object.entries(grouped)
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <PageHeader
        title="Downvoted findings"
        description={`${feedback.length} downvotes across ${items.length} unique findings`}
      />
      <FeedbackList items={items} />
    </div>
  )
}
