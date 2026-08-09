import { canSharePublicly } from '@/lib/auth/entitlements'
import { prisma } from '@/lib/db'
import { flagHasFixPrompt, type RankableFlag } from '@/lib/audit/priority-flags'

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

export function canViewDeterministicFixes(
  audit: { userId: string | null; aiReviewAt: Date | null; isPublic?: boolean },
  viewer: { id: string } | null | undefined
): boolean {
  if (isPublicMarketingSample(audit)) return true
  if (!viewer?.id) return false
  return audit.userId === viewer.id
}

export function canViewAiViaStudioPublicShare(
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
  return canViewAiViaStudioPublicShare(audit, owner ? canSharePublicly(owner) : false)
}

export async function canViewDeterministicFixesForAudit(
  audit: AiAccessAudit,
  viewer: { id: string } | null | undefined
): Promise<boolean> {
  return canViewDeterministicFixes(audit, viewer)
}

type FlagLike = {
  id?: string | null
  source?: string | null
  severity?: string | null
  problem?: string | null
  rubric?: string | null
  checkId?: string | null
  impactTag?: string | null
  confidence?: number | null
  agentPrompt?: string | null
  cursorPrompt?: string | null
  claudePrompt?: string | null
  windsurfPrompt?: string | null
  lovablePrompt?: string | null
  boltPrompt?: string | null
  whyItMatters?: string | null
  evidence?: string | null
  fix?: string | null
  verificationRule?: string | null
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

/** Strip AI prescription fields only; keep deterministic fix, evidence, and whyItMatters. */
export function stripAiPrescriptionFromFlags<T extends FlagLike>(flags: T[]): T[] {
  return flags.map((f) => ({
    ...f,
    agentPrompt: null,
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
  }))
}

/** Strip fix prompts for anonymous / non-owner viewers. Keep evidence and whyItMatters (triage value). */
export function stripDeterministicFixesFromFlags<T extends FlagLike>(flags: T[]): T[] {
  return flags.map((f) => ({
    ...f,
    agentPrompt: null,
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    fix: null,
    verificationRule: null,
  }))
}

export function stripPrescriptionFromFlags<T extends FlagLike>(flags: T[]): T[] {
  return stripDeterministicFixesFromFlags(flags)
}

export function stripAiPrescriptionFromRubrics<T extends RubricLike>(rubrics: T[]): T[] {
  return rubrics.map((r) => ({
    ...r,
    rubricPrompt: null,
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    flags: r.flags ? stripAiPrescriptionFromFlags(r.flags) : r.flags,
  }))
}

export function stripDeterministicFixesFromRubrics<T extends RubricLike>(rubrics: T[]): T[] {
  return rubrics.map((r) => ({
    ...r,
    rubricPrompt: null,
    cursorPrompt: null,
    claudePrompt: null,
    lovablePrompt: null,
    boltPrompt: null,
    flags: r.flags ? stripDeterministicFixesFromFlags(r.flags) : r.flags,
  }))
}

const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  IMPORTANT: 1,
  POLISH: 2,
}

/** Find the highest-severity flag with a usable (non-placeholder) fix prompt. */
export function findHighestSeverityFlagWithFix<T extends FlagLike>(flags: T[]): T | null {
  const withFix = flags.filter((f) =>
    flagHasFixPrompt({
      id: String(f.id ?? f.problem ?? 'flag'),
      problem: String(f.problem ?? ''),
      severity: (f.severity as RankableFlag['severity']) ?? 'POLISH',
      rubric: (f.rubric as RankableFlag['rubric']) ?? 'MESSAGE',
      checkId: typeof f.checkId === 'string' ? f.checkId : undefined,
      impactTag: (f.impactTag as RankableFlag['impactTag']) ?? undefined,
      confidence: typeof f.confidence === 'number' ? f.confidence : null,
      fix: typeof f.fix === 'string' ? f.fix : undefined,
      agentPrompt: typeof f.agentPrompt === 'string' ? f.agentPrompt : null,
      cursorPrompt: typeof f.cursorPrompt === 'string' ? f.cursorPrompt : null,
      claudePrompt: typeof f.claudePrompt === 'string' ? f.claudePrompt : null,
      windsurfPrompt: typeof f.windsurfPrompt === 'string' ? f.windsurfPrompt : null,
      lovablePrompt: typeof f.lovablePrompt === 'string' ? f.lovablePrompt : null,
      boltPrompt: typeof f.boltPrompt === 'string' ? f.boltPrompt : null,
    })
  )
  if (withFix.length === 0) return null
  return withFix.sort(
    (a, b) => (SEVERITY_RANK[a.severity as string] ?? 99) - (SEVERITY_RANK[b.severity as string] ?? 99)
  )[0]
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
          flags: r.flags ? stripAiPrescriptionFromFlags(r.flags) : r.flags,
        }))
      : audit.rubrics,
  }
}
