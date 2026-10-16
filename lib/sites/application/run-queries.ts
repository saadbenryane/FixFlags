import { prisma } from '@/lib/db'
import { analysisTaskWhere } from '@/lib/audit/progressive/contracts'
import { currentOutcomeState } from '@/lib/sites/outcome-state'
import { readExecutionSpec } from '../domain/execution-spec'
import { buildCoverageFacts } from '../coverage'
import { projectSiteAssessment, recordedRunFlags, recordedDiagnosticConclusion, recordedAccountConclusion } from '../assessment'
import { isCustomerFlag } from '@/lib/audit/attention'
import { siteCoverageExecutionSelect } from './site-execution'
import { SITE_ASSESSMENT_COPY } from '@/lib/marketing/copy/site-assessment'
import { FLAG_COMPARISON_TARGET } from '@/lib/audit/flag-comparison'
import { categoryCoverageFact } from './category-evidence'
import { SITE_COVERAGE_MAX_AGE_MS } from '../coverage'

export async function getOwnedRun(userId: string, runId: string) {
  const run = await prisma.runRequest.findFirst({
    where: { id: runId, project: { userId, deletedAt: null } },
    include: {
      selections: { include: { outcome: true } },
      assessments: true,
      audit: { select: { id: true, parentId: true, progress: true, status: true, completedAt: true, reportCompleteness: true,
        evidenceCoverage: true, failureCode: true, failedModules: true,
        verifierExecutions: { ...siteCoverageExecutionSelect,
          select: { ...siteCoverageExecutionSelect.select, workState: true },
          where: { OR: [...siteCoverageExecutionSelect.where.OR, { targetKey: FLAG_COMPARISON_TARGET },
            { ...analysisTaskWhere, audit: { executionSpec: { path: ['scope'], equals: 'CATEGORY' } } }] } },
        pages: { select: { url: true, status: true } },
        verificationAttempts: { select: { id: true, sourceAuditId: true, verificationAuditId: true,
          outcome: true, comparable: true, evidenceReference: true } },
        flags: { select: { severity: true, confidence: true, checkId: true, rubric: true, impactTag: true, attentionPolicy: true } },
      } },
    },
  })
  if (!run) return null
  const now = new Date()
  const primarySelection = run.selections[0] ?? null
  const primaryAssessment = primarySelection
    ? run.assessments.find((item) => item.outcomeId === primarySelection.outcomeId) ?? null
    : null
  const outcomes = run.selections.map((selection) => {
    const assessment = run.assessments.find((item) => item.outcomeId === selection.outcomeId)
    return {
      outcomeId: selection.outcomeId,
      outcomeName: selection.outcome.name,
      result: assessment ? currentOutcomeState(assessment, now) : null,
      summary: assessment?.summary ?? null,
      coverage: assessment?.coverage ?? null,
      evidence: assessment?.evidence ?? null,
      assessedAt: assessment?.assessedAt.toISOString() ?? null,
      validUntil: assessment?.validUntil.toISOString() ?? null,
    }
  })
  const spec = readExecutionSpec(run.executionSpec)
  const broad = spec?.scope === 'SITE' || spec?.scope === 'CATEGORY'
  const recorded = recordedRunFlags({ executionSpec: run.executionSpec, audit: run.audit })
  const diagnostic = recordedDiagnosticConclusion({ executionSpec: run.executionSpec, audit: run.audit })
  const accountTask = spec?.scope === 'ACCOUNT_CHECKS' && run.auditId ? await prisma.auditVerifierExecution.findFirst({
    where: { auditId: run.auditId, targetKey: 'task:automatic-accounts', workKind: 'automatic-accounts', workState: 'COMPLETED' },
    select: { workResult: true },
  }) : null
  const account = recordedAccountConclusion(run.executionSpec, accountTask?.workResult)
  const scopedConclusion = diagnostic ?? account
  const categoryFact = spec?.category && run.audit ? categoryCoverageFact({ ...run.audit, executionSpec: run.executionSpec }, now) : null
  const assessment = projectSiteAssessment({
    status: run.status, executionSpec: run.executionSpec, now,
    requiredAreas: broad ? undefined : [],
    // A run describes recorded observations, even after a later repair changes
    // the source Flag's current lifecycle status.
    flags: broad ? recorded.flags.filter(flag => isCustomerFlag({ ...flag, status: undefined })) : [],
    assessmentComplete: recorded.complete,
    scopedConclusion: scopedConclusion ? { ...scopedConclusion, validUntil: run.audit?.completedAt
      ? new Date(run.audit.completedAt.getTime() + SITE_COVERAGE_MAX_AGE_MS) : null } : null,
    coverage: categoryFact ? [categoryFact] : broad && run.audit ? buildCoverageFacts({ auditStatus: run.audit.status, completedAt: run.audit.completedAt,
      now, evidenceCoverage: run.audit.evidenceCoverage, failureCode: run.audit.failureCode,
      failedModules: run.audit.failedModules, verifierExecutions: run.audit.verifierExecutions, flags: [] }) : [],
    checkedAt: run.audit?.completedAt,
    pagesComplete: spec?.category ? spec.category.pages.every(url => run.audit?.pages.some(page => page.url === url && page.status === 'COMPLETED'))
      : broad ? Boolean(run.audit?.pages.length) && run.audit!.pages.every(page => page.status === 'COMPLETED') : undefined,
    outcomes: broad ? spec.outcomes.map(outcome => {
      const recorded = run.assessments.find(assessment => assessment.outcomeId === outcome.id)
      return { id: outcome.id, state: currentOutcomeState(recorded ?? null, now), validUntil: recorded?.validUntil }
    }) : outcomes.map(outcome => ({ id: outcome.outcomeId, state: outcome.result ?? 'COULD_NOT_VERIFY',
      validUntil: outcome.validUntil ? new Date(outcome.validUntil) : null })),
  })
  const settled = run.status === 'COMPLETED' || run.status === 'FAILED'
  const result = assessment.result
  return {
    id: run.id,
    source: run.source,
    status: run.status,
    progress: run.audit?.progress ?? (run.status === 'COMPLETED' ? 100 : 0),
    outcomeId: broad ? null : primarySelection?.outcomeId ?? null,
    outcomeName: broad ? null : primarySelection?.outcome.name ?? null,
    outcomes,
    verificationTarget: run.verificationTarget,
    scope: spec?.scope ?? null,
    area: spec?.category?.area ?? null,
    coverage: assessment,
    completionState: settled ? assessment.completeness : 'PENDING',
    checkedAt: run.audit?.completedAt?.toISOString() ?? null,
    validUntil: assessment.validUntil ?? (outcomes.length > 0 && outcomes.every(outcome => outcome.validUntil)
      ? outcomes.map(outcome => outcome.validUntil!).sort()[0] : null),
    result,
    summary: !settled || !result ? null : diagnostic ? SITE_ASSESSMENT_COPY.diagnostic[result]
      : account ? SITE_ASSESSMENT_COPY.accounts[result]
      : spec?.category ? SITE_ASSESSMENT_COPY.category[result] : broad ? SITE_ASSESSMENT_COPY.site[result]
      : result === 'FAILED' || result === 'STALE' ? SITE_ASSESSMENT_COPY.outcomes[result] : outcomes.length === 1
        ? primaryAssessment?.summary ?? SITE_ASSESSMENT_COPY.outcomes[result] : SITE_ASSESSMENT_COPY.outcomes[result],
    auditId: run.auditId,
    requestedAt: run.requestedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    error: run.errorMessage,
  }
}
