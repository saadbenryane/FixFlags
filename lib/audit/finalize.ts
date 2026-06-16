import { prisma } from '@/lib/db'
import { persistAuditRunCost } from '@/lib/billing/costs'
import { diffFlagsAgainstParent } from '@/lib/audit/diff-flags'
import { applyDeterministicVerification } from '@/lib/audit/verify-flags'
import { incrementUsageOnCompleteForAudit } from '@/lib/audit/usage'
import { consumeTrialRecheckOnSuccess } from '@/lib/auth/entitlements'
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { upsertLeadFromAudit } from '@/lib/leads/upsert-from-audit'

interface FinalizeAuditInput {
  auditId: string
  durationMs: number
  pagespeedCalls: number
  usage: {
    inputTokens: number
    outputTokens: number
    model: string
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

export async function finalizeAudit(input: FinalizeAuditInput): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: input.auditId },
    select: {
      id: true,
      status: true,
      userId: true,
      parentId: true,
      trialRecheck: true,
      completedAt: true,
    },
  })
  if (!audit) throw new Error(`Audit ${input.auditId} not found during finalization`)
  if (audit.status === 'COMPLETED' && audit.completedAt) return
  if (audit.status !== 'FINALIZING') {
    throw new Error(`Audit ${input.auditId} is not ready to finalize`)
  }

  await persistAuditRunCost(input.auditId, {
    durationMs: input.durationMs,
    llmInputTokens: input.usage.inputTokens,
    llmOutputTokens: input.usage.outputTokens,
    llmModel: input.usage.model,
    pagespeedCalls: input.pagespeedCalls,
  })

  if (audit.parentId) {
    await diffFlagsAgainstParent(input.auditId, audit.parentId)
    const parent = await prisma.audit.findUnique({
      where: { id: audit.parentId },
      select: { url: true },
    })
    if (parent?.url) {
      await applyDeterministicVerification(input.auditId, audit.parentId, parent.url)
    }
  }

  if (audit.userId) {
    await incrementUsageOnCompleteForAudit(input.auditId, audit.userId)
    if (audit.trialRecheck && audit.parentId) {
      await consumeTrialRecheckOnSuccess(audit.userId)
    }
  }

  const requiredComplete =
    input.evidence.desktopScreenshot &&
    input.evidence.metadata &&
    input.evidence.aiAssessment
  if (!requiredComplete) {
    throw new Error('Required audit evidence is incomplete')
  }

  const completeness =
    input.evidence.mobileScreenshot &&
    input.evidence.desktopPageSpeed &&
    input.evidence.mobilePageSpeed
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
      completedAt: audit.completedAt ?? new Date(),
      finalizedAt: new Date(),
      failureCode: null,
      failureStage: null,
      failureMetadata: undefined,
    },
  })

  await upsertLeadFromAudit(input.auditId).catch(() => {
    // Lead upsert must not fail audit finalization
  })
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
      trialRecheck: true,
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

  if (audit.parentId) {
    await diffFlagsAgainstParent(input.auditId, audit.parentId)
  }

  if (audit.userId) {
    await incrementUsageOnCompleteForAudit(input.auditId, audit.userId)
    if (audit.trialRecheck && audit.parentId) {
      await consumeTrialRecheckOnSuccess(audit.userId)
    }
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

  await upsertLeadFromAudit(input.auditId).catch(() => {
    // Lead upsert must not fail audit finalization
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
