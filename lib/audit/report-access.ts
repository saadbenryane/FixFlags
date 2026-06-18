import { canSharePublicly } from '@/lib/auth/entitlements'
import { prisma } from '@/lib/db'

export function canViewAiReportContent(
  audit: {
    userId: string | null
    aiReviewAt: Date | null
    isPublic?: boolean
  },
  viewer: { id: string } | null | undefined
): boolean {
  if (!audit.aiReviewAt) return false
  if (!viewer?.id) return false
  if (audit.userId === viewer.id) return true
  return false
}

export async function canViewAiReportContentForAudit(
  audit: {
    userId: string | null
    aiReviewAt: Date | null
    isPublic?: boolean
  },
  viewer: { id: string } | null | undefined
): Promise<boolean> {
  if (!canViewAiReportContent(audit, viewer)) {
    if (!audit.aiReviewAt || !audit.isPublic || !audit.userId) return false
    const owner = await prisma.user.findUnique({
      where: { id: audit.userId },
      select: { id: true, role: true, plan: true },
    })
    return owner ? canSharePublicly(owner) : false
  }
  return true
}

type FlagLike = {
  source?: string | null
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  whyItMatters?: string | null
  [key: string]: unknown
}

type RubricLike = {
  summary?: string | null
  rubricPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  flags?: FlagLike[]
  [key: string]: unknown
}

export function stripAiFromFlags<T extends FlagLike>(flags: T[]): T[] {
  return flags
    .filter((f) => f.source !== 'AI')
    .map((f) => ({
      ...f,
      agentPrompt: null,
      cursorPrompt: null,
      claudePrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
      whyItMatters: null,
    }))
}

export function stripAiFromRubrics<T extends RubricLike>(rubrics: T[]): T[] {
  return rubrics.map((r) => ({
    ...r,
    summary: '',
    rubricPrompt: '',
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    flags: r.flags ? stripAiFromFlags(r.flags) : r.flags,
  }))
}

export function stripAiFromAudit<T extends {
  verdict?: string | null
  pageJob?: string | null
  pageType?: string | null
  launchReadiness?: unknown
  flags: FlagLike[]
  rubrics?: RubricLike[]
}>(audit: T): T {
  return {
    ...audit,
    verdict: null,
    pageJob: null,
    pageType: null,
    launchReadiness: null,
    flags: stripAiFromFlags(audit.flags),
    rubrics: audit.rubrics ? stripAiFromRubrics(audit.rubrics) : audit.rubrics,
  }
}
