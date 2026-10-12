import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { executeAccountChecks } from '@/lib/sites/accounts/executor'
import { accountResultSchema, safeEvidenceUrl, accountObservationContext, collapseAccountObservations } from '@/lib/sites/accounts/contracts'
import { assertAccountPermission } from '@/lib/sites/accounts/store'
import { serializeArtifact, TaskFailure } from './contracts'
import { flagSchema, commitFindings, commitCheckReceipt } from './results'
import type { TaskHandler } from './registry'
import { accountAssertion, accountCheckId } from '@/lib/sites/accounts/check-definitions'

const artifactSchema = accountResultSchema.extend({ flags: z.array(flagSchema).max(100) }).strict()
export const accountHandlers: TaskHandler[] = [{ kind: 'automatic-accounts', replay: 'protected', timeoutMs: 180_000,
  validateResult: artifact => { artifactSchema.parse(artifact.data) },
  // The executor reconciles reserved identities through login and deletion state.
  // It never replays a signup after SUBMITTING was persisted.
  async reconcile(context) {
    const intent = readExecutionSpec(context.audit.executionSpec)?.accountChecks
    if (!intent || !context.audit.projectId) return false
    try { await assertAccountPermission(context.audit.projectId, intent); return true } catch { return false }
  },
  async evaluate(context) {
    const spec = readExecutionSpec(context.audit.executionSpec), projectId = context.audit.projectId
    if (!spec?.accountChecks || !projectId || context.audit.isPublic) throw new TaskFailure('ACCOUNT_CHECKS_NOT_ADMITTED', false)
    const result = await executeAccountChecks({ projectId, auditId: context.audit.id, intent: spec.accountChecks,
      targetUrl: spec.accountChecks.siteUrl ?? spec.targetUrl, deadline: context.deadline })
    result.observations = collapseAccountObservations(result.observations)
    const flags = result.observations.filter(item => item.state === 'failed').map(item => ({
      checkId: accountCheckId[item.kind], rubric: 'EXPERIENCE' as const, severity: 'IMPORTANT' as const,
      problem: item.detail, evidence: item.detail, fix: 'Restore the observed account behavior, then ask FixFlags to check the same flow again.',
      verificationRule: 'Automatic account observation v1', confidence: 0.95, source: 'DETERMINISTIC' as const, impactTag: 'CONVERSION', pageUrl: item.pageUrl,
      evidenceTargets: [{ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const,
        label: item.kind === 'signed_in' ? 'Signed-in page' : 'Test-account flow', context: accountObservationContext(item) }],
    }))
    return serializeArtifact('automatic-accounts', artifactSchema.parse({ ...result, flags }))
  },
  async commit(context, artifact, tx) {
    const result = artifactSchema.parse(artifact.data), projectId = context.audit.projectId!
    const intent = readExecutionSpec(context.audit.executionSpec)!.accountChecks!
    await assertAccountPermission(projectId, intent, tx)
    for (const item of result.observations) {
      await tx.siteAccountCheckReceipt.upsert({ where: { auditId_kind_pageUrl: { auditId: context.audit.id, kind: item.kind, pageUrl: item.pageUrl } },
        update: { state: item.state, detail: item.detail, evidence: item.evidence as Prisma.InputJsonValue },
        create: { projectId, auditId: context.audit.id, ...item, evidence: item.evidence as Prisma.InputJsonValue } })
      await commitCheckReceipt(context, { kind: 'site-module-check', version: 1, module: 'automatic-accounts', applicable: item.state !== 'unavailable',
        passed: item.state === 'verified', complete: item.state !== 'unknown', pageUrl: safeEvidenceUrl(item.pageUrl),
        limitation: item.state === 'unknown' || item.state === 'unavailable' ? item.detail : undefined,
        assertions: [{ key: accountAssertion[item.kind], name: item.kind.replace('_', ' '), expected: 'The observed account behavior completes successfully.',
          observed: item.detail, passed: item.state === 'verified', complete: item.state === 'verified' || item.state === 'failed', context: accountObservationContext(item) }],
        execution: { auditId: context.audit.id, taskId: context.task.id, checkVersion: 1, source: 'rendered-dom', collectedAt: artifact.collectedAt } }, tx, ':' + item.kind)
    }
    await commitFindings(context, artifact, tx)
  },
}]
