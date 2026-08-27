import { Suspense } from 'react'
import { prisma } from '@/lib/db'
import { Container } from '@/components/ui/container'
import { PageHeader } from '@/components/layout/PageHeader'
import { FeedbackHub } from '@/components/admin/FeedbackHub'
import { closeOrphanSupportSessions, getAdminUnreadCount } from '@/lib/live-support/sessions'
import type { FlagReactionGroup, ReportReactionItem } from '@/components/admin/ReactionsList'

function domainFrom(url: string | null | undefined): string {
  if (!url) return 'unknown'
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default async function AdminFeedbackPage() {
  await closeOrphanSupportSessions().catch(() => 0)

  const [reportRows, flagRows, unread] = await Promise.all([
    prisma.auditFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: { audit: { select: { url: true, normalizedDomain: true } } },
    }),
    prisma.flagFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      take: 500,
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
    }),
    getAdminUnreadCount().catch(() => 0),
  ])

  const reportSummary = {
    up: reportRows.filter((r) => r.vote > 0).length,
    down: reportRows.filter((r) => r.vote < 0).length,
    total: reportRows.length,
  }

  const reportComments: ReportReactionItem[] = reportRows
    .filter((r) => r.comment && r.comment.trim())
    .map((r) => ({
      id: r.id,
      vote: r.vote,
      comment: r.comment,
      domain: r.audit?.normalizedDomain ?? domainFrom(r.audit?.url),
      auditId: r.auditId,
      createdAt: r.createdAt.toISOString(),
    }))

  const groupMap = new Map<string, FlagReactionGroup>()
  for (const r of flagRows) {
    const key = r.flag.checkId ?? r.flag.id
    let g = groupMap.get(key)
    if (!g) {
      g = {
        key,
        problem: r.flag.problem,
        checkId: r.flag.checkId,
        rubric: r.flag.rubric,
        severity: r.flag.severity,
        evidence: r.flag.evidence,
        sampleAuditId: r.flag.auditId,
        up: 0,
        down: 0,
        comments: [],
      }
      groupMap.set(key, g)
    }
    if (r.vote > 0) g.up++
    else g.down++
    if (r.comment && r.comment.trim()) g.comments.push(r.comment.trim())
  }
  const flagGroups = [...groupMap.values()]
  const reactionCount = reportRows.length + flagRows.length

  return (
    <Container variant="wide" className="space-y-6 py-8">
      <PageHeader
        title="Feedback & Support"
        description="Live chat, report reactions, Flag reactions, and a copyable digest."
      />
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
        <FeedbackHub
          reactions={{ reportSummary, reportComments, flagGroups }}
          reactionCount={reactionCount}
          unread={unread}
        />
      </Suspense>
    </Container>
  )
}
