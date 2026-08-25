import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { persistAuditRunCost } from '@/lib/billing/costs'
import { diffFlagsAgainstParent } from '@/lib/audit/diff-flags'
import {
  materializeAttentionForAudit,
  reconcileImprovementVerification,
} from '@/lib/improvements/service'
import { incrementUsageOnCompleteForAudit } from '@/lib/audit/usage'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { upsertLeadFromAudit } from '@/lib/leads/upsert-from-audit'
import { persistAuditGraphSnapshot } from '@/lib/graph/snapshot'
import { logger } from '@/lib/logger'
import { triageDegradedVerdict } from '@/lib/audit/triage-verdict'
import { triageFailureCode } from '@/lib/audit/pipeline/triage-failure'
import { DETERMINISTIC_SCAN_VERDICT } from '@/lib/audit/verdict'
import type { TriageFailureReason } from '@/lib/audit/pipeline/triage-failure'

type FinalizeBaseInput = {
  auditId: string
  durationMs: number
  pagespeedCalls: number
  usage: {
    inputTokens: number
    outputTokens: number
    model: string
    cacheReadTokens?: number
    cacheWriteTokens?: number
  }
  evidence: {
    desktopScreenshot: boolean
    mobileScreenshot: boolean
    metadata: boolean
    aiAssessment: boolean
    desktopPageSpeed: boolean
    mobilePageSpeed: boolean
    flowScan?: boolean
  }
}

export async function persistImprovementCycle(
  auditId: string,
  parentId: string | null
): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { improvementProjectedAt: true },
  })
  if (!audit || audit.improvementProjectedAt) return

  try {
    if (parentId) await diffFlagsAgainstParent(auditId, parentId)
    await materializeAttentionForAudit(auditId)
    if (parentId) {
      await reconcileImprovementVerification({
        parentAuditId: parentId,
        verificationAuditId: auditId,
      })
    }
    // improvementProjectedAt is a completion receipt, not a lease. Write it
    // only after every idempotent projection step succeeds so a process crash
    // leaves the Review recoverable by the scheduler.
    await prisma.audit.updateMany({
      where: { id: auditId, status: 'COMPLETED', improvementProjectedAt: null },
      data: { improvementProjectedAt: new Date() },
    })
  } catch (error) {
    await logPipelineEvent(auditId, {
      stage: 'completed',
      event: 'improvement_projection_failed',
      error: error instanceof Error ? error.message : String(error),
    }).catch((logError) => {
      logger.error('Improvement projection failure could not be logged', logError)
    })
    throw error
  }
}

async function completeImprovementProjection(
  auditId: string,
  parentId: string | null
): Promise<void> {
  await persistImprovementCycle(auditId, parentId)
}

/**
 * Union of deterministic check-module names that threw across page runs.
 * Persisted so the report can surface "some checks couldn't run" instead of
 * silently dropping an entire check area.
 */
export async function persistAuditFailedModules(
  auditId: string,
  pageRuns: Array<{ failedModules: string[] }>
): Promise<void> {
  const modules = [...new Set(pageRuns.flatMap((page) => page.failedModules))].sort()
  await prisma.audit.update({
    where: { id: auditId },
    data: modules.length > 0 ? { failedModules: modules } : { failedModules: Prisma.JsonNull },
  })
}

/** Complete phase-1 triage. Anonymous visitors stop here; signed-up users may enqueue prescription. */
export async function finalizeTriageAudit(input: FinalizeBaseInput): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: {
      id: true,
      status: true,
      userId: true,
      parentId: true,
      completedAt: true,
      triageAt: true,
    },
  })
  if (!audit) throw new Error(`Audit ${input.auditId} not found during triage finalization`)
  if (audit.triageAt && audit.status === 'COMPLETED' && audit.completedAt) return
  if (audit.status !== 'FINALIZING') {
    throw new Error(`Audit ${input.auditId} is not ready to finalize triage`)
  }

  await persistAuditRunCost(input.auditId, {
    durationMs: input.durationMs,
    llmInputTokens: input.usage.inputTokens,
    llmOutputTokens: input.usage.outputTokens,
    llmModel: input.usage.model,
    pagespeedCalls: input.pagespeedCalls,
    llmCacheReadTokens: input.usage.cacheReadTokens,
    llmCacheWriteTokens: input.usage.cacheWriteTokens,
    phase: 'triage',
  })

  const requiredComplete =
    input.evidence.desktopScreenshot &&
    input.evidence.metadata &&
    input.evidence.aiAssessment
  if (!requiredComplete) {
    throw new Error('Required audit evidence is incomplete')
  }

  const completeness =
    input.evidence.desktopScreenshot && input.evidence.metadata ? 'FULL' : 'PARTIAL'

  await logPipelineEvent(input.auditId, { stage: 'finalizing', event: 'triage_completed' })

  await prisma.audit.update({
    where: { id: input.auditId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: completeness,
      evidenceCoverage: input.evidence,
      triageAt: new Date(),
      completedAt: audit.completedAt ?? new Date(),
      finalizedAt: new Date(),
      failureCode: null,
      failureStage: null,
      failureMetadata: undefined,
      errorMsg: null,
    },
  })

  if (audit.userId) {
    await incrementUsageOnCompleteForAudit(input.auditId, audit.userId)
  }

  await completeImprovementProjection(input.auditId, audit.parentId)

  await upsertLeadFromAudit(input.auditId).catch((err) => {
    logger.error('Lead upsert failed after triage finalize', err)
  })

  await persistAuditGraphSnapshot(input.auditId).catch((err) => {
    logger.error('Knowledge-graph persist failed after triage finalize', err)
  })
}

interface TriageDegradedFinalizeInput {
  auditId: string
  durationMs: number
  pagespeedCalls: number
  usage?: {
    inputTokens: number
    outputTokens: number
    model: string
  }
  evidence: {
    desktopScreenshot: boolean
    mobileScreenshot: boolean
    metadata: boolean
    desktopPageSpeed: boolean
    mobilePageSpeed: boolean
    flowScan?: boolean
  }
  reason: TriageFailureReason
  errorMsg: string
}

/** Complete with deterministic evidence when triage failed after capture and checks. */
export async function finalizeTriageDegraded(
  input: TriageDegradedFinalizeInput
): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: {
      id: true,
      status: true,
      userId: true,
      parentId: true,
      completedAt: true,
    },
  })
  if (!audit) return
  if (audit.status === 'COMPLETED' && audit.completedAt) return

  if (input.usage && (input.usage.inputTokens > 0 || input.usage.outputTokens > 0)) {
    await persistAuditRunCost(input.auditId, {
      durationMs: input.durationMs,
      llmInputTokens: input.usage.inputTokens,
      llmOutputTokens: input.usage.outputTokens,
      llmModel: input.usage.model || 'none',
      pagespeedCalls: input.pagespeedCalls,
      phase: 'triage',
    })
  } else {
    await persistAuditRunCost(input.auditId, {
      durationMs: input.durationMs,
      llmInputTokens: 0,
      llmOutputTokens: 0,
      llmModel: 'none',
      pagespeedCalls: input.pagespeedCalls,
    })
  }

  const failureCode = triageFailureCode(input.reason)
  const verdict = triageDegradedVerdict(input.reason, Boolean(audit.userId))

  await logPipelineEvent(input.auditId, {
    stage: 'judging',
    event: 'triage_degraded_completed',
    error: input.errorMsg,
    detail: input.reason,
  })

  await prisma.audit.update({
    where: { id: input.auditId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: 'PARTIAL',
      evidenceCoverage: {
        ...input.evidence,
        aiAssessment: false,
      },
      verdict,
      completedAt: audit.completedAt ?? new Date(),
      finalizedAt: new Date(),
      errorMsg: input.errorMsg,
      failureCode,
      failureStage: 'judging',
    },
  })

  if (audit.userId) {
    await incrementUsageOnCompleteForAudit(input.auditId, audit.userId)
  }

  await completeImprovementProjection(input.auditId, audit.parentId)

  await upsertLeadFromAudit(input.auditId).catch((err) => {
    logger.error('Lead upsert failed after triage degraded finalize', err)
  })

  await persistAuditGraphSnapshot(input.auditId).catch((err) => {
    logger.error('Knowledge-graph persist failed after triage degraded finalize', err)
  })
}

export async function finalizeAudit(input: FinalizeBaseInput): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: {
      id: true,
      status: true,
      userId: true,
      parentId: true,
      completedAt: true,
      aiReviewAt: true,
    },
  })
  if (!audit) throw new Error(`Audit ${input.auditId} not found during finalization`)
  if (audit.status === 'COMPLETED' && audit.completedAt && audit.aiReviewAt) return
  if (audit.status !== 'FINALIZING' && audit.status !== 'JUDGING') {
    throw new Error(`Audit ${input.auditId} is not ready to finalize prescription`)
  }

  await persistAuditRunCost(input.auditId, {
    durationMs: input.durationMs,
    llmInputTokens: input.usage.inputTokens,
    llmOutputTokens: input.usage.outputTokens,
    llmModel: input.usage.model,
    pagespeedCalls: input.pagespeedCalls,
    llmCacheReadTokens: input.usage.cacheReadTokens,
    llmCacheWriteTokens: input.usage.cacheWriteTokens,
    phase: 'prescription',
  })

  const requiredComplete =
    input.evidence.desktopScreenshot &&
    input.evidence.metadata &&
    input.evidence.aiAssessment
  if (!requiredComplete) {
    throw new Error('Required audit evidence is incomplete')
  }

  const completeness =
    input.evidence.desktopScreenshot && input.evidence.metadata
      ? 'FULL'
      : 'PARTIAL'

  await logPipelineEvent(input.auditId, { stage: 'finalizing', event: 'completed' })

  await prisma.audit.update({
    where: { id: input.auditId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: completeness,
      evidenceCoverage: input.evidence,
      aiReviewAt: new Date(),
      completedAt: audit.completedAt ?? new Date(),
      finalizedAt: new Date(),
      failureCode: null,
      failureStage: null,
      failureMetadata: undefined,
    },
  })

  // Triage completion owns the durable Product projection and usage. The
  // prescription phase enriches prompts only and must not re-diff or re-verify.
  if (audit.userId && input.evidence.aiAssessment) {
    await incrementUsageOnCompleteForAudit(input.auditId, audit.userId)
  }
}

interface PartialFinalizeInput {
  auditId: string
  durationMs: number
  pagespeedCalls: number
  usage?: {
    inputTokens: number
    outputTokens: number
    model: string
  }
  evidence: {
    desktopScreenshot: boolean
    mobileScreenshot: boolean
    metadata: boolean
    desktopPageSpeed: boolean
    mobilePageSpeed: boolean
  }
  failureCode: string
  failureStage: string
  errorMsg: string
}

/** Complete audit with deterministic results when AI review fails or times out. */
export async function finalizePartialAudit(input: PartialFinalizeInput): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: {
      id: true,
      status: true,
      userId: true,
      parentId: true,
      completedAt: true,
      verdict: true,
    },
  })
  if (!audit) return
  if (audit.status === 'COMPLETED' && audit.completedAt) return

  if (input.usage && (input.usage.inputTokens > 0 || input.usage.outputTokens > 0)) {
    await persistAuditRunCost(input.auditId, {
      durationMs: input.durationMs,
      llmInputTokens: input.usage.inputTokens,
      llmOutputTokens: input.usage.outputTokens,
      llmModel: input.usage.model || 'none',
      pagespeedCalls: input.pagespeedCalls,
    })
  }

  const stubVerdict =
    audit.verdict ??
    'AI summary unavailable, deterministic checks and screenshots are shown below.'

  await logPipelineEvent(input.auditId, {
    stage: input.failureStage,
    event: 'partial_completed',
    error: input.errorMsg,
  })

  await prisma.audit.update({
    where: { id: input.auditId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: 'PARTIAL',
      evidenceCoverage: {
        ...input.evidence,
        aiAssessment: false,
      },
      verdict: stubVerdict,
      completedAt: audit.completedAt ?? new Date(),
      finalizedAt: new Date(),
      errorMsg: input.errorMsg,
      failureCode: input.failureCode,
      failureStage: input.failureStage,
    },
  })

  if (audit.userId) {
    await incrementUsageOnCompleteForAudit(input.auditId, audit.userId)
  }

  await completeImprovementProjection(input.auditId, audit.parentId)

  await upsertLeadFromAudit(input.auditId).catch((err) => {
    logger.error('Lead upsert failed after audit finalize', err)
  })
}

interface DeterministicFinalizeInput {
  auditId: string
  durationMs: number
  pagespeedCalls: number
  evidence: {
    desktopScreenshot: boolean
    mobileScreenshot: boolean
    metadata: boolean
    desktopPageSpeed: boolean
    mobilePageSpeed: boolean
    flowScan?: boolean
  }
}

/** Complete audit with deterministic results only (no LLM judge). */
export async function finalizeDeterministicOnly(
  input: DeterministicFinalizeInput
): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: {
      id: true,
      status: true,
      completedAt: true,
    },
  })
  if (!audit) return
  if (audit.status === 'COMPLETED' && audit.completedAt) return

  await persistAuditRunCost(input.auditId, {
    durationMs: input.durationMs,
    llmInputTokens: 0,
    llmOutputTokens: 0,
    llmModel: 'none',
    pagespeedCalls: input.pagespeedCalls,
  })

  const completeness =
    input.evidence.desktopScreenshot && input.evidence.metadata
      ? 'FULL'
      : 'PARTIAL'

  await logPipelineEvent(input.auditId, { stage: 'finalizing', event: 'deterministic_completed' })

  await prisma.audit.update({
    where: { id: input.auditId },
    data: {
      status: 'COMPLETED',
      progress: 100,
      reportCompleteness: completeness,
      evidenceCoverage: {
        ...input.evidence,
        aiAssessment: false,
      },
      verdict: DETERMINISTIC_SCAN_VERDICT,
      completedAt: audit.completedAt ?? new Date(),
      finalizedAt: new Date(),
      failureCode: null,
      failureStage: null,
      failureMetadata: undefined,
      errorMsg: null,
    },
  })

  await completeImprovementProjection(input.auditId, null)

  await upsertLeadFromAudit(input.auditId).catch((err) => {
    logger.error('Lead upsert failed after deterministic finalize', err)
  })

  await persistAuditGraphSnapshot(input.auditId).catch((err) => {
    logger.error('Knowledge-graph persist failed after deterministic finalize', err)
  })
}

export async function persistFailedAuditCost(
  auditId: string,
  durationMs: number,
  pagespeedCalls: number,
  usage?: { inputTokens: number; outputTokens: number; model: string }
): Promise<void> {
  if (!usage || (usage.inputTokens === 0 && usage.outputTokens === 0)) return
  await persistAuditRunCost(auditId, {
    durationMs,
    llmInputTokens: usage.inputTokens,
    llmOutputTokens: usage.outputTokens,
    llmModel: usage.model || 'none',
    pagespeedCalls,
  })
}
