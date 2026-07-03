import { prisma } from '@/lib/db'
import { FeedbackList } from '@/components/admin/FeedbackList'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'

export default async function AdminFeedbackPage() {
  const feedback = await prisma.flagFeedback.findMany({
    where: { vote: -1 },
    include: {
      flag: {
        select: {
          id: true,
          auditId: true,
          problem: true,
          checkId: true,
          rubric: true,
          severity: true,
          evidence: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  const grouped = feedback.reduce<
    Record<
      string,
      {
        problem: string
        checkId: string | null
        rubric: string
        severity: string
        evidence: string
        auditId: string
        count: number
      }
    >
  >((acc, item) => {
    const key = item.flag.checkId ?? item.flag.id
    if (!acc[key]) {
      acc[key] = {
        problem: item.flag.problem,
        checkId: item.flag.checkId,
        rubric: item.flag.rubric,
        severity: item.flag.severity,
        evidence: item.flag.evidence,
        auditId: item.flag.auditId,
        count: 0,
      }
    }
    acc[key].count++
    return acc
  }, {})

  const items = Object.entries(grouped)
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.count - a.count)

  return (
    <Container variant="wide" className="space-y-8 py-8">
      <PageHeader
        title="Downvoted flags"
        description={`${feedback.length} downvotes across ${items.length} unique flags`}
      />
      <FeedbackList items={items} />
    </Container>
  )
}
