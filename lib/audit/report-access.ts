import { canSharePublicly } from '@/lib/auth/entitlements'
import { prisma } from '@/lib/db'

type AiAccessAudit = {
  userId: string | null
  aiReviewAt: Date | null
  isPublic?: boolean
}

/** Public anonymous audits used as marketing samples (homepage /samples). */
export function isPublicMarketingSample(audit: AiAccessAudit): boolean {
  return Boolean(audit.isPublic && audit.userId === null && audit.aiReviewAt)
}

export function canViewPrescriptionContent(
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

export function canViewAiViaMaxPublicShare(
  audit: AiAccessAudit,
  ownerCanSharePublicly: boolean
): boolean {
  if (!audit.aiReviewAt || !audit.isPublic || !audit.userId) return false
  return ownerCanSharePublicly
}

export async function canViewPrescriptionContentForAudit(
  audit: AiAccessAudit,
  viewer: { id: string } | null | undefined
): Promise<boolean> {
  if (isPublicMarketingSample(audit)) return true
  if (canViewPrescriptionContent(audit, viewer)) return true
  if (!audit.aiReviewAt || !audit.isPublic || !audit.userId) return false
  const owner = await prisma.user.findUnique({
    where: { id: audit.userId },
    select: { id: true, role: true, plan: true, subscriptionStatus: true },
  })
  return owner ? canSharePublicly(owner) : false
}

type FlagLike = {
  source?: string | null
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  whyItMatters?: string | null
  evidence?: string | null
  fix?: string | null
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

/** Strip prescription-only fields; keep phase-1 triage titles and rubric summaries. */
export function stripPrescriptionFromFlags<T extends FlagLike>(flags: T[]): T[] {
  return flags.map((f) => ({
    ...f,
    agentPrompt: null,
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    whyItMatters: null,
    evidence: null,
    fix: null,
  }))
}

/** @deprecated Use stripPrescriptionFromFlags */
export function stripAiFromFlags<T extends FlagLike>(flags: T[]): T[] {
  return stripPrescriptionFromFlags(flags)
}

export function stripPrescriptionFromRubrics<T extends RubricLike>(rubrics: T[]): T[] {
  return rubrics.map((r) => ({
    ...r,
    rubricPrompt: null,
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    flags: r.flags ? stripPrescriptionFromFlags(r.flags) : r.flags,
  }))
}

/** Legacy deterministic-only audits (no triageAt): hide AI fields entirely. */
export function stripLegacyDeterministicAudit<T extends {
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
    flags: audit.flags
      .filter((f) => f.source !== 'AI')
      .map((f) => ({
        ...f,
        agentPrompt: null,
        cursorPrompt: null,
        claudePrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        whyItMatters: null,
      })),
    rubrics: audit.rubrics
      ? audit.rubrics.map((r) => ({
          ...r,
          summary: '',
          rubricPrompt: '',
          cursorPrompt: null,
          claudePrompt: null,
          lovablePrompt: null,
          boltPrompt: null,
          flags: r.flags ? stripPrescriptionFromFlags(r.flags) : r.flags,
        }))
      : audit.rubrics,
  }
}

export function stripPrescriptionFromAudit<T extends {
  verdict?: string | null
  pageJob?: string | null
  pageType?: string | null
  launchReadiness?: unknown
  flags: FlagLike[]
  rubrics?: RubricLike[]
}>(audit: T): T {
  return {
    ...audit,
    flags: stripPrescriptionFromFlags(audit.flags),
    rubrics: audit.rubrics ? stripPrescriptionFromRubrics(audit.rubrics) : audit.rubrics,
  }
}


