import { prisma } from '@/lib/db'
import { flagComparisonAuditScopeSelect } from '@/lib/audit/flag-comparison'
import { analysisEvidenceTaskWhere } from '@/lib/audit/progressive/contracts'
import { readExecutionSpec, readVerificationTarget } from '../domain/execution-spec'
import { attemptHasActiveVerification } from '@/lib/improvements/attempt-state'
import { projectSiteAssessment, recordedRepairConclusion, recordedAccountConclusion } from '../assessment'
import { siteCoverageExecutionSelect } from './site-execution'
import { SITE_ASSESSMENT_COPY } from '@/lib/marketing/copy/site-assessment'
import { SITE_COVERAGE_MAX_AGE_MS } from '../evidence-freshness'
import { projectRecordedSiteResult } from './recorded-assessment'
import { readSiteEvidence } from './site-evidence-read'
import { recordedOutcomes } from './recorded-outcomes'

export async function getOwnedRun(userId: string, runId: string, projectId?: string) {
  const run = await prisma.runRequest.findFirst({
    where: { id: runId, ...(projectId !== undefined ? { projectId } : {}),
      project: { userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } } },
    include: {
      selections: { select: { outcomeId: true, outcome: { select: { projectId: true, name: true } } } },
      assessments: true,
      audit: { select: { id: true, ...flagComparisonAuditScopeSelect, progress: true, status: true, completedAt: true, reportCompleteness: true, executionSpec: true,
        evidenceCoverage: true, failureCode: true, failedModules: true,
        verifierExecutions: { ...siteCoverageExecutionSelect,
          select: { ...siteCoverageExecutionSelect.select, workState: true, workDependencies: true },
          where: { OR: [...siteCoverageExecutionSelect.where.OR,
            { workKind: 'finalize', workState: { in: ['READY', 'RUNNING', 'RETRY_WAIT'] } },
            { ...analysisEvidenceTaskWhere, audit: { executionSpec: { path: ['scope'], equals: 'CATEGORY' } } }] } },
        pages: { select: { url: true, status: true } },
        verificationAttempts: { select: { id: true, sourceAuditId: true, verificationAuditId: true,
          outcome: true, comparable: true, evidenceReference: true } },
        flags: { select: { severity: true, confidence: true, checkId: true, rubric: true, impactTag: true, attentionPolicy: true } },
      } },
    },
  })
  if (!run || run.audit && run.audit.projectId !== run.projectId) return null
  return readSiteEvidence({ kind: 'project', projectId: run.projectId, userId }, async () => {
    const now = new Date()
    const recorded = recordedOutcomes({ executionSpec: run.executionSpec, auditId: run.auditId,
      projectId: run.projectId, request: run, now })
    const outcomes = recorded.flatMap(({ id, selection, assessment, state }) => selection ? [{
      outcomeId: id,
      outcomeName: selection.name,
      result: assessment ? state : null,
      summary: assessment?.summary ?? null,
      coverage: assessment?.coverage ?? null,
      evidence: assessment?.evidence ?? null,
      assessedAt: assessment?.assessedAt.toISOString() ?? null,
      validUntil: assessment?.validUntil.toISOString() ?? null,
    }] : [])
    const spec = readExecutionSpec(run.executionSpec)
    const target = readVerificationTarget(run.verificationTarget ?? spec?.verificationTarget)
    const attempt = target && run.audit?.verificationAttempts.find(item => item.id === target.attemptId &&
      item.sourceAuditId === target.parentAuditId && item.verificationAuditId === run.audit!.id)
    // Binding collection can settle before the exact repair comparison commits.
    const finalizingRepair = run.status === 'COMPLETED' && target && attempt && attemptHasActiveVerification({ ...attempt,
      verificationAudit: run.audit }, run.projectId, target.parentAuditId)
    const status = finalizingRepair ? 'RUNNING' : run.status
    const broad = spec?.scope === 'SITE' || spec?.scope === 'CATEGORY'
    const repair = recordedRepairConclusion({ executionSpec: run.executionSpec, verificationTarget: run.verificationTarget, audit: run.audit })
    const accountTask = spec?.scope === 'ACCOUNT_CHECKS' && run.auditId ? await prisma.auditExecutionTask.findFirst({
      where: { auditId: run.auditId, targetKey: 'task:automatic-accounts', workKind: 'automatic-accounts', workState: 'COMPLETED' },
      select: { workResult: true },
    }) : null
    const account = recordedAccountConclusion(run.executionSpec, accountTask?.workResult)
    const scopedConclusion = repair ?? account
    const repairOutcome = repair?.outcomeId ? recorded.find(item => item.id === repair.outcomeId) : null
    const validUntil = (repairOutcome?.assessment?.state !== 'COULD_NOT_VERIFY' ? repairOutcome?.recordedUntil : null) ?? (run.audit?.completedAt
      ? new Date(run.audit.completedAt.getTime() + SITE_COVERAGE_MAX_AGE_MS) : null)
    const expiredRepair = repair?.outcomeId && repair.complete && validUntil && validUntil <= now
    const assessment = broad && run.audit && !repair ? projectRecordedSiteResult({ audit: run.audit, executionSpec: run.executionSpec,
      status: run.status, assessments: recorded.flatMap(item => item.assessment ? [item.assessment] : []), now }).assessment : projectSiteAssessment({
      status, executionSpec: run.executionSpec, now,
      requiredAreas: broad ? undefined : [],
      flags: [],
      assessmentComplete: !broad,
      scopedConclusion: scopedConclusion ? { ...scopedConclusion, state: expiredRepair ? 'STALE' : scopedConclusion.state, validUntil } : null,
      coverage: [],
      checkedAt: run.audit?.completedAt,
      pagesComplete: broad ? false : undefined,
      outcomes: repair ? [] : recorded,
    })
    const settled = status === 'COMPLETED' || status === 'FAILED'
    const result = assessment.result
    return {
      id: run.id,
      source: run.source,
      status,
      progress: run.audit?.progress ?? (run.status === 'COMPLETED' ? 100 : 0),
      outcomeId: broad ? null : outcomes[0]?.outcomeId ?? null,
      outcomeName: broad ? null : outcomes[0]?.outcomeName ?? null,
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
      summary: !settled || !result ? null : repair ? SITE_ASSESSMENT_COPY.diagnostic[result]
        : account ? SITE_ASSESSMENT_COPY.accounts[result]
        : spec?.category ? SITE_ASSESSMENT_COPY.category[result] : broad ? SITE_ASSESSMENT_COPY.site[result]
        : result !== 'FAILED' && result !== 'STALE' && recorded.length === 1 && outcomes[0]?.summary
          ? outcomes[0].summary : SITE_ASSESSMENT_COPY.outcomes[result],
      auditId: run.auditId,
      requestedAt: run.requestedAt.toISOString(),
      completedAt: settled ? run.completedAt?.toISOString() ?? null : null,
      error: run.errorMessage,
    }
  })
}
