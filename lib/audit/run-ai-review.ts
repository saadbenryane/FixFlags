import { prisma } from '@/lib/db'
import { computeRubricScores, type DeterministicFlag } from './checks'
import { runJudge, type JudgeResult } from './judge'
import { persistAuditResults } from './persist'
import { tryResolveEvidenceAnchorsForAudit } from './persist-evidence-anchors'
import { finalizeAudit } from './finalize'
import { AUDIT_PROGRESS } from './progress'
import { validateJudgeOutput, JudgeContractError } from './validate-judge-output'
import { loadParentScreenshotBase64 } from './copy-parent-artifacts'
import type { PageSpeedResult } from './pagespeed'
import type { PageMetadata } from './metadata'
import { logPipelineEvent } from './pipeline-log'
import { remainingAiReportCredits } from './ai-report-entitlement'
import { hasUnlimitedScans } from '@/lib/auth/permissions'

function flagToDeterministic(flag: {
  checkId: string | null
  rubric: string
  severity: string
  problem: string
  evidence: string
  fix: string
  confidence: number | null
  impactTag: string | null
  pageUrl: string | null
}): DeterministicFlag | null {
  if (!flag.checkId) return null
  return {
    checkId: flag.checkId,
    rubric: flag.rubric as DeterministicFlag['rubric'],
    severity: flag.severity as DeterministicFlag['severity'],
    problem: flag.problem,
    evidence: flag.evidence,
    fix: flag.fix,
    confidence: flag.confidence ?? 0.8,
    impactTag: flag.impactTag as DeterministicFlag['impactTag'],
    pageUrl: flag.pageUrl ?? undefined,
    source: 'DETERMINISTIC',
  }
}

/** Run LLM judge on a completed deterministic audit and unlock the full AI report. */
export async function runAiReview(auditId: string): Promise<void> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    include: {
      flags: { where: { source: 'DETERMINISTIC' }, orderBy: { position: 'asc' } },
    },
  })

  if (!audit) throw new Error(`Audit ${auditId} not found`)
  if (audit.aiReviewAt) return
  if (audit.status !== 'COMPLETED') {
    throw new Error(`Audit ${auditId} is not ready for AI review`)
  }
  if (!audit.userId) {
    throw new Error(`Audit ${auditId} must be claimed before AI review`)
  }

  const user = await prisma.user.findUnique({
    where: { id: audit.userId },
    select: { id: true, role: true, plan: true, auditsUsed: true, auditsLimit: true },
  })
  if (!user) throw new Error('Audit owner not found')
  if (!hasUnlimitedScans(user) && (await remainingAiReportCredits(user)) <= 0) {
    throw new Error('AI report limit reached')
  }

  const metadata = audit.htmlMetadata as PageMetadata | null
  if (!metadata) throw new Error('Audit metadata missing for AI review')

  const perf = audit.performanceData as {
    desktop?: PageSpeedResult | null
    mobile?: PageSpeedResult | null
  } | null

  const { desktopBase64, mobileBase64 } = await loadParentScreenshotBase64(auditId)
  if (!desktopBase64) throw new Error('Desktop screenshot missing for AI review')

  const detFlags = audit.flags
    .map(flagToDeterministic)
    .filter((f): f is DeterministicFlag => f !== null)

  const startedAt = Date.now()
  await prisma.audit.update({
    where: { id: auditId },
    data: { status: 'JUDGING', progress: AUDIT_PROGRESS.JUDGING, includeAi: true },
  })
  await logPipelineEvent(auditId, { stage: 'judging', event: 'ai_review_started' })

  let judge: JudgeResult
  try {
    judge = await runJudge(
      audit.url,
      metadata,
      perf?.desktop ?? null,
      perf?.mobile ?? null,
      detFlags,
      desktopBase64,
      mobileBase64
    )
    judge.output = validateJudgeOutput(judge.output, detFlags)
  } catch (error) {
    await prisma.audit.update({
      where: { id: auditId },
      data: {
        status: 'COMPLETED',
        errorMsg: error instanceof Error ? error.message : 'AI review failed',
        failureCode: error instanceof JudgeContractError ? 'AI_CONTRACT_INVALID' : 'AI_REVIEW_FAILED',
        failureStage: 'judging',
      },
    })
    throw error
  }

  const evidence = audit.evidenceCoverage as {
    desktopPageSpeed?: boolean
    mobilePageSpeed?: boolean
  } | null

  const rubricScores = computeRubricScores(
    detFlags,
    perf?.desktop ?? null,
    perf?.mobile ?? null,
    {
      pageSpeedAvailable: {
        desktop: evidence?.desktopPageSpeed ?? Boolean(perf?.desktop),
        mobile: evidence?.mobilePageSpeed ?? Boolean(perf?.mobile),
      },
    }
  )

  await logPipelineEvent(auditId, { stage: 'finalizing', event: 'ai_review_persist' })
  await persistAuditResults(auditId, judge.output, detFlags, rubricScores)
  await tryResolveEvidenceAnchorsForAudit(
    auditId,
    audit.url,
    detFlags.map((flag) => flag.checkId)
  )

  await finalizeAudit({
    auditId,
    durationMs: Date.now() - startedAt,
    pagespeedCalls: 0,
    usage: {
      inputTokens: judge.usage.inputTokens,
      outputTokens: judge.usage.outputTokens,
      model: judge.usage.model,
    },
    evidence: {
      desktopScreenshot: true,
      mobileScreenshot: Boolean(mobileBase64),
      metadata: true,
      aiAssessment: true,
      desktopPageSpeed: Boolean(perf?.desktop),
      mobilePageSpeed: Boolean(perf?.mobile),
      flowScan: Boolean(audit.flowData),
    },
  })
}
