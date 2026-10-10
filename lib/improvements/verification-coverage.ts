import type { Prisma, ReportCompleteness } from '@prisma/client'
import { verifierScopeKey, verifierTargetKey } from './verifier-provenance'

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
  verifierExecutions: Array<{
    targetKey: string
    scopeKey: string
    status: 'COMPLETED' | 'FAILED' | 'NOT_APPLICABLE'
    evidenceReference: Prisma.JsonValue | null
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
  const evidenceComparable = Boolean(
    evidence.desktopScreenshot && evidence.metadata && (!isAi || evidence.aiAssessment)
  )
  const relevantPageCovered = input.pageUrl
    ? input.pages.some(
        (page) =>
          page.status === 'COMPLETED' && normalizeUrl(page.url) === normalizeUrl(input.pageUrl!)
      )
    : input.pages.some((page) => page.status === 'COMPLETED')
  const supportingVerifierCompleted = isJourney
    ? input.journeyReviewIncluded && Boolean(input.journeyReviewAt)
    : isAi
      ? Boolean(evidence.aiAssessment)
      : true
  const verifierExecuted = Boolean(
    targetExecution?.status === 'COMPLETED' &&
    targetExecution.evidenceReference &&
    supportingVerifierCompleted,
  )

  const coverage: VerificationCoverage = {
    completeReview,
    evidenceComparable,
    relevantPageCovered,
    verifierExecuted,
    verifierStatus: targetExecution?.status ?? 'MISSING',
    targetKey,
    scopeKey,
    executionEvidenceReference: targetExecution?.evidenceReference ?? null,
    failedModules,
    source: input.source,
    pageUrl: input.pageUrl,
  }

  if (!completeReview) {
    return { comparable: false, reason: 'The update Review was partial or incomplete.', coverage }
  }
  if (!evidenceComparable) {
    return { comparable: false, reason: 'The update Review did not capture comparable evidence.', coverage }
  }
  if (!relevantPageCovered) {
    return { comparable: false, reason: 'The update Review did not complete the affected page.', coverage }
  }
  if (failedModules.length > 0) {
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
  run: {
    id: string; projectId: string; status: string; environment: string; verificationTarget: Prisma.JsonValue
    assessments: Array<{ outcomeId: string; auditId: string; runRequestId: string; state: string; coverage: Prisma.JsonValue; evidence: Prisma.JsonValue }>
  }
  sourceAssessment: { state: string; coverage: Prisma.JsonValue } | null
}): VerificationCoverageDecision {
  const record = (value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> =>
    value && !Array.isArray(value) && typeof value === 'object' ? value as Record<string, Prisma.JsonValue> : {}
  const keys = (value: Prisma.JsonValue | undefined): string[] => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').sort() : []
  const target = record(input.run.verificationTarget)
  const assessment = input.run.assessments.find(item => item.outcomeId === input.outcomeId && item.auditId === input.auditId && item.runRequestId === input.run.id)
  const source = record(input.sourceAssessment?.coverage ?? null)
  const observed = record(assessment?.coverage ?? null)
  const required = keys(observed.requiredBindings)
  const bindings = (value: Prisma.JsonValue | undefined): Prisma.JsonValue[] => Array.isArray(value)
    ? [...value].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))) : []
  const sourceBindings = bindings(source.bindings)
  const observedBindings = bindings(observed.bindings)
  const sameScope = required.length > 0 && JSON.stringify(required) === JSON.stringify(keys(source.requiredBindings)) &&
    sourceBindings.length === required.length && observedBindings.length === required.length &&
    JSON.stringify(sourceBindings) === JSON.stringify(observedBindings) &&
    observed.environment === source.environment && observed.environment === input.run.environment &&
    JSON.stringify(observed.scope ?? null) === JSON.stringify(source.scope ?? null)
  const conclusive = assessment?.state === 'CLEAR' || assessment?.state === 'FLAG'
  const executed = Boolean(assessment && Object.keys(record(assessment.evidence)).length > 0 &&
    required.every(key => keys(observed.observedBindings).includes(key)))
  const comparable = input.auditStatus === 'COMPLETED' && input.run.status === 'COMPLETED' &&
    input.run.projectId === input.projectId && target.kind === 'OUTCOME' && target.attemptId === input.attemptId &&
    target.outcomeId === input.outcomeId && target.parentAuditId === input.parentAuditId &&
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
