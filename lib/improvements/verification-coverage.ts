import { comparableOutcomeCoverage, completeOutcomeEvidence } from '@/lib/sites/domain/outcome-proof'
import type { Prisma, ReportCompleteness } from '@prisma/client'
import { verifierScopeKey, verifierTargetKey } from './verifier-provenance'
import { searchVerifierSchema } from '@/lib/audit/search/contracts'
import { checkVerifierSchema } from '@/lib/audit/checks/verification'
import { hasRecordedRecoveryEvidence, type RecoveryFlag } from '@/lib/audit/recovery-evidence'
import { baseCheckId } from '@/lib/audit/flag-identity'

type EvidenceCoverage = {
  desktopScreenshot?: boolean
  mobileScreenshot?: boolean
  metadata?: boolean
  aiAssessment?: boolean
  flowScan?: boolean
}

export type VerificationCoverage = {
  completeReview: boolean
  evidenceComparable: boolean
  relevantPageCovered: boolean
  verifierExecuted: boolean
  verifierStatus: 'COMPLETED' | 'FAILED' | 'NOT_APPLICABLE' | 'MISSING'
  targetKey: string | null
  scopeKey: string
  executionEvidenceReference: Prisma.JsonValue | null
  failedModules: string[]
  source: string
  pageUrl: string | null
}

export type VerificationCoverageDecision = {
  comparable: boolean
  reason: string
  coverage: VerificationCoverage
}

function parseFailedModules(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function parseEvidenceCoverage(value: unknown): EvidenceCoverage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as EvidenceCoverage
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch {
    return value.replace(/\/$/, '')
  }
}

export function assessVerificationCoverage(input: {
  auditId?: string
  status: string
  reportCompleteness: ReportCompleteness
  evidenceCoverage: unknown
  failedModules: unknown
  journeyReviewIncluded: boolean
  journeyReviewAt: Date | null
  pages: Array<{ url: string; status: string }>
  source: string
  checkId: string | null
  fingerprint?: string | null
  pageUrl: string | null
  executionSpec?: unknown
  originalFlag?: RecoveryFlag
  verifierExecutions: Array<{
    targetKey: string
    scopeKey: string
    status: 'COMPLETED' | 'FAILED' | 'NOT_APPLICABLE' | 'PENDING' | 'RUNNING'
    evidenceReference: Prisma.JsonValue | null
    detail?: Prisma.JsonValue | null
  }>
}): VerificationCoverageDecision {
  const failedModules = parseFailedModules(input.failedModules)
  const evidence = parseEvidenceCoverage(input.evidenceCoverage)
  const isAi = input.source === 'AI'
  const isJourney = input.checkId?.startsWith('journey-') ?? false
  const targetKey = verifierTargetKey(input)
  const scopeKey = verifierScopeKey(input.pageUrl)
  const targetExecution = targetKey
    ? input.verifierExecutions.find(
        (execution) => execution.targetKey === targetKey && execution.scopeKey === scopeKey,
      )
    : undefined
  const completeReview =
    input.status === 'COMPLETED' && input.reportCompleteness === 'FULL'
  const recordedRecovery = Boolean(input.auditId && input.originalFlag && input.checkId &&
    baseCheckId(input.originalFlag.checkId) === baseCheckId(input.checkId) &&
    normalizeUrl(input.originalFlag.pageUrl ?? '') === normalizeUrl(input.pageUrl ?? '') && input.status === 'COMPLETED' &&
    hasRecordedRecoveryEvidence({ auditId: input.auditId, executionSpec: input.executionSpec,
      flag: input.originalFlag, executions: input.verifierExecutions.map(row => ({ ...row, detail: row.detail })) }))
  const search = searchVerifierSchema.safeParse(targetExecution?.detail)
  const isSearch = search.success && search.data.auditId === input.auditId && search.data.pageUrl === input.pageUrl &&
    search.data.checkId === input.checkId?.split('::page:')[0]
  const exactCheck = checkVerifierSchema.safeParse(targetExecution?.detail)
  const isExactCheck = exactCheck.success && exactCheck.data.auditId === input.auditId &&
    exactCheck.data.checkId === input.checkId?.split('::page:')[0] &&
    (!input.pageUrl || normalizeUrl(exactCheck.data.pageUrl) === normalizeUrl(input.pageUrl))
  const evidenceComparable = Boolean(
    recordedRecovery || (isExactCheck ? exactCheck.data.comparable : isSearch ? search.data.comparable : evidence.desktopScreenshot && evidence.metadata && (!isAi || evidence.aiAssessment))
  )
  const relevantPageCovered = recordedRecovery || isExactCheck || (input.pageUrl
    ? input.pages.some(
        (page) =>
          page.status === 'COMPLETED' && normalizeUrl(page.url) === normalizeUrl(input.pageUrl!)
      )
    : input.pages.some((page) => page.status === 'COMPLETED'))
  const supportingVerifierCompleted = isJourney
    ? input.journeyReviewIncluded && Boolean(input.journeyReviewAt)
    : isAi
      ? Boolean(evidence.aiAssessment)
      : true
  const verifierExecuted = Boolean(
    recordedRecovery || targetExecution?.status === 'COMPLETED' &&
    targetExecution.evidenceReference &&
    supportingVerifierCompleted,
  )

  const coverage: VerificationCoverage = {
    completeReview,
    evidenceComparable,
    relevantPageCovered,
    verifierExecuted,
    verifierStatus: recordedRecovery ? 'COMPLETED' : targetExecution?.status === 'COMPLETED' || targetExecution?.status === 'FAILED' ||
      targetExecution?.status === 'NOT_APPLICABLE' ? targetExecution.status : 'MISSING',
    targetKey,
    scopeKey,
    executionEvidenceReference: recordedRecovery ? { kind: 'recorded-recovery', auditId: input.auditId!,
      checkId: input.originalFlag!.checkId ?? null, pageUrl: input.originalFlag!.pageUrl ?? null,
      affectedPaths: Array.isArray(input.originalFlag!.affectedPaths) ? input.originalFlag!.affectedPaths.filter((value): value is string => typeof value === 'string') : [],
    } : targetExecution?.evidenceReference ?? null,
    failedModules,
    source: input.source,
    pageUrl: input.pageUrl,
  }

  if (!completeReview && !recordedRecovery && !((isSearch || isExactCheck) && input.status === 'COMPLETED')) {
    return { comparable: false, reason: 'The update Review was partial or incomplete.', coverage }
  }
  if (!evidenceComparable) {
    return { comparable: false, reason: 'The update Review did not capture comparable evidence.', coverage }
  }
  if (!relevantPageCovered) {
    return { comparable: false, reason: 'The update Review did not complete the affected page.', coverage }
  }
  if (failedModules.length > 0 && !recordedRecovery && !isSearch && !isExactCheck) {
    return {
      comparable: false,
      reason: `The update Review was degraded because these modules failed: ${failedModules.join(', ')}.`,
      coverage,
    }
  }
  if (!verifierExecuted) {
    return {
      comparable: false,
      reason: targetExecution?.status === 'FAILED'
        ? 'The exact applicable verifier failed.'
        : targetExecution?.status === 'NOT_APPLICABLE'
          ? 'The exact verifier was not applicable to the captured scope.'
          : !targetExecution
            ? 'The update Review has no positive execution record for the exact verifier and scope.'
            : !targetExecution.evidenceReference
              ? 'The exact verifier completed without a durable evidence reference.'
              : isJourney
                ? 'The applicable journey verification did not complete.'
                : isAi
                  ? 'The applicable AI assessment did not complete.'
                  : 'The applicable verifier did not complete.',
      coverage,
    }
  }
  return {
    comparable: true,
    reason: 'The fresh update Review completed comparable verification coverage.',
    coverage,
  }
}

/** Targeted Outcome proof uses the same required binding scope as its failure. */
export function assessTargetedOutcomeCoverage(input: {
  auditId: string; auditStatus: string; projectId: string; parentAuditId: string
  outcomeId: string | null; attemptId: string
  targeted?: boolean
  run: {
    id: string; projectId: string; status: string; environment: string; verificationTarget: Prisma.JsonValue
    assessments: Array<{ outcomeId: string; auditId: string; runRequestId: string; state: string; coverage: Prisma.JsonValue; evidence: Prisma.JsonValue }>
  }
  sourceAssessment: { state: string; coverage: Prisma.JsonValue } | null
}): VerificationCoverageDecision {
  const record = (value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> =>
    value && !Array.isArray(value) && typeof value === 'object' ? value as Record<string, Prisma.JsonValue> : {}
  const target = record(input.run.verificationTarget)
  const assessment = input.run.assessments.find(item => item.outcomeId === input.outcomeId && item.auditId === input.auditId && item.runRequestId === input.run.id)
  const observed = record(assessment?.coverage ?? null)
  const sameScope = comparableOutcomeCoverage(input.sourceAssessment?.coverage, observed) && observed.environment === input.run.environment
  const conclusive = assessment?.state === 'CLEAR' || assessment?.state === 'FLAG'
  const executed = completeOutcomeEvidence(observed, assessment?.evidence)
  const intended = input.targeted === false ? input.run.verificationTarget === null : target.kind === 'OUTCOME' &&
    target.attemptId === input.attemptId && target.outcomeId === input.outcomeId && target.parentAuditId === input.parentAuditId
  const comparable = input.auditStatus === 'COMPLETED' && input.run.status === 'COMPLETED' &&
    input.run.projectId === input.projectId && intended &&
    input.sourceAssessment?.state === 'FLAG' && sameScope && conclusive && executed
  return {
    comparable,
    reason: comparable ? 'The same behavior was checked again.' : 'This check did not cover the same behavior.',
    coverage: {
      completeReview: input.auditStatus === 'COMPLETED', evidenceComparable: comparable,
      relevantPageCovered: sameScope, verifierExecuted: executed,
      verifierStatus: executed ? 'COMPLETED' : 'MISSING', targetKey: input.outcomeId ? `outcome:${input.outcomeId}` : null,
      scopeKey: input.run.environment, executionEvidenceReference: assessment?.evidence ?? null,
      failedModules: [], source: 'OUTCOME', pageUrl: null,
    },
  }
}
