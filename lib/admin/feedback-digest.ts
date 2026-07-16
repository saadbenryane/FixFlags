import { prisma } from '@/lib/db'
import { BRAND } from '@/lib/marketing/copy'

const DAY_MS = 86_400_000

export interface FeedbackDigestOptions {
  /** Look back this many days. Defaults to 30. */
  days?: number
}

export interface FeedbackDigestResult {
  markdown: string
  since: Date
  counts: {
    conversations: number
    reportReactions: number
    flagReactions: number
    comments: number
  }
}

function roleLabel(role: string): string {
  if (role === 'VISITOR') return 'User'
  if (role === 'AGENT') return `${BRAND.name} team`
  return 'System'
}

function domainFrom(url: string | null | undefined): string {
  if (!url) return 'unknown'
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Build a single structured markdown document that bundles recent live-chat
 * conversations plus report- and flag-level reactions (with any written
 * comments). It is designed to be copied straight into an AI assistant to
 * mine for concrete product improvements.
 */
export async function buildFeedbackDigest(
  options: FeedbackDigestOptions = {}
): Promise<FeedbackDigestResult> {
  const days = Math.min(Math.max(options.days ?? 30, 1), 365)
  const since = new Date(Date.now() - days * DAY_MS)

  const [sessions, reportReactions, flagReactions] = await Promise.all([
    prisma.supportSession.findMany({
      where: { lastMessageAt: { gte: since } },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      include: {
        lead: { select: { normalizedDomain: true, latestScore: true } },
        user: { select: { email: true, plan: true } },
        messages: { orderBy: { createdAt: 'asc' }, select: { role: true, body: true, createdAt: true } },
      },
    }),
    prisma.auditFeedback.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 500,
      include: { audit: { select: { url: true, normalizedDomain: true } } },
    }),
    prisma.flagFeedback.findMany({
      where: { createdAt: { gte: since } },
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
          },
        },
      },
    }),
  ])

  let commentCount = 0
  const lines: string[] = []

  lines.push(`# ${BRAND.name} - user feedback digest`)
  lines.push('')
  lines.push(
    `_Window: last ${days} day${days === 1 ? '' : 's'} (since ${since.toISOString().slice(0, 10)}). Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC._`
  )
  lines.push('')

  // --- Summary ---------------------------------------------------------------
  const reportUp = reportReactions.filter((r) => r.vote > 0).length
  const reportDown = reportReactions.filter((r) => r.vote < 0).length
  const flagUp = flagReactions.filter((r) => r.vote > 0).length
  const flagDown = flagReactions.filter((r) => r.vote < 0).length

  lines.push('## Summary')
  lines.push('')
  lines.push(`- Conversations: **${sessions.length}**`)
  lines.push(`- Report reactions: **${reportReactions.length}** (👍 ${reportUp} / 👎 ${reportDown})`)
  lines.push(`- Flag reactions: **${flagReactions.length}** (👍 ${flagUp} / 👎 ${flagDown})`)
  lines.push('')

  // --- Conversations ---------------------------------------------------------
  lines.push('## Conversations')
  lines.push('')
  const chats = sessions.filter((s) => s.messages.some((m) => m.role !== 'SYSTEM'))
  if (chats.length === 0) {
    lines.push('_No chat conversations in this window._')
    lines.push('')
  } else {
    for (const s of chats) {
      const who = s.visitorEmail ?? s.user?.email ?? s.visitorName ?? 'Anonymous visitor'
      const context: string[] = []
      if (s.user?.plan) context.push(`${s.user.plan} plan`)
      if (s.lead?.normalizedDomain) context.push(s.lead.normalizedDomain)
      if (s.pageUrl) context.push(`on ${s.pageUrl}`)
      lines.push(`### ${who}${context.length ? ` - ${context.join(', ')}` : ''} · ${s.status}`)
      for (const m of s.messages) {
        if (m.role === 'SYSTEM') continue
        const body = m.body.trim().replace(/\n+/g, ' ')
        lines.push(`- **${roleLabel(m.role)}:** ${body}`)
      }
      lines.push('')
    }
  }

  // --- Report reactions ------------------------------------------------------
  lines.push('## Report reactions ("Was this report useful?")')
  lines.push('')
  const reportComments = reportReactions.filter((r) => r.comment && r.comment.trim())
  commentCount += reportComments.length
  if (reportReactions.length === 0) {
    lines.push('_No report reactions in this window._')
    lines.push('')
  } else {
    lines.push(`👍 ${reportUp} · 👎 ${reportDown} across ${reportReactions.length} reactions.`)
    lines.push('')
    if (reportComments.length > 0) {
      lines.push('Comments:')
      for (const r of reportComments) {
        const mark = r.vote > 0 ? '👍' : '👎'
        const domain = r.audit?.normalizedDomain ?? domainFrom(r.audit?.url)
        lines.push(`- ${mark} (${domain}, report \`${r.auditId}\`): "${r.comment!.trim()}"`)
      }
      lines.push('')
    }
  }

  // --- Flag reactions (grouped by check) -------------------------------------
  lines.push('## Flag reactions (per-issue 👍/👎)')
  lines.push('')
  type Group = {
    problem: string
    checkId: string | null
    rubric: string
    severity: string
    up: number
    down: number
    sampleAuditId: string
    comments: string[]
  }
  const groups = new Map<string, Group>()
  for (const r of flagReactions) {
    const key = r.flag.checkId ?? r.flag.id
    let g = groups.get(key)
    if (!g) {
      g = {
        problem: r.flag.problem,
        checkId: r.flag.checkId,
        rubric: r.flag.rubric,
        severity: r.flag.severity,
        up: 0,
        down: 0,
        sampleAuditId: r.flag.auditId,
        comments: [],
      }
      groups.set(key, g)
    }
    if (r.vote > 0) g.up++
    else g.down++
    if (r.comment && r.comment.trim()) {
      g.comments.push(r.comment.trim())
      commentCount++
    }
  }
  if (groups.size === 0) {
    lines.push('_No flag reactions in this window._')
    lines.push('')
  } else {
    const sorted = [...groups.values()].sort((a, b) => b.down - a.down || b.up - a.up)
    for (const g of sorted) {
      const check = g.checkId ? ` \`${g.checkId}\`` : ''
      lines.push(`### ${g.severity} · ${g.rubric}${check} 👍 ${g.up} / 👎 ${g.down}`)
      lines.push(`- Problem: ${g.problem}`)
      lines.push(`- Sample audit: \`${g.sampleAuditId}\``)
      for (const c of g.comments) {
        lines.push(`- Comment: "${c}"`)
      }
      lines.push('')
    }
  }

  // --- Instruction footer ----------------------------------------------------
  lines.push('---')
  lines.push('')
  lines.push(
    `You are helping improve **${BRAND.name}**. Based on the conversations and reactions above, ` +
      'identify recurring themes, rank the top product and audit-quality issues by frequency and ' +
      'severity, and propose concrete, actionable improvements. Call out any flags that users ' +
      'repeatedly mark as wrong so we can fix or retune those checks.'
  )
  lines.push('')

  return {
    markdown: lines.join('\n'),
    since,
    counts: {
      conversations: chats.length,
      reportReactions: reportReactions.length,
      flagReactions: flagReactions.length,
      comments: commentCount,
    },
  }
}
