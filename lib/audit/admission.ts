import type { Prisma, RecheckTrigger } from '@prisma/client'
import type { AdminDomainActor } from '@/lib/admin/domain-actor'
import type { ScheduledRunClaim } from '@/lib/sites/application/scheduled-admission'
import type { ExecutionSpec } from '@/lib/sites/domain/execution-spec'

export type AuditAdmission =
  | { kind: 'new-check' }
  | { kind: 'update'; parentId: string; trigger?: RecheckTrigger; allowance: 'metered' | 'included'; verificationAttemptId?: string }
  | { kind: 'retry'; parentId: string }
  | { kind: 'site-run'; parentId?: string; executionSpec: ExecutionSpec;
      request: Prisma.RunRequestUncheckedCreateInput & { id: string };
      scheduledClaim?: ScheduledRunClaim; operator?: AdminDomainActor; verificationAttemptId?: string }

/** Execution and charging policy follow admitted intent, never independent switches. */
export function resolveAuditAdmission(admission: AuditAdmission) {
  const defaults = { parentId: undefined as string | undefined, recheckTrigger: undefined as RecheckTrigger | undefined,
    skipUsageCount: false, retryParent: false, reuseActiveManual: true, monitoringMode: 'FULL' as const,
    verificationAttemptId: undefined as string | undefined, runRequestId: undefined as string | undefined,
    runRequestAdmission: undefined as Prisma.RunRequestUncheckedCreateInput | undefined,
    executionSpec: undefined as ExecutionSpec | undefined, scheduledClaim: undefined as ScheduledRunClaim | undefined,
    operator: undefined as AdminDomainActor | undefined }
  switch (admission?.kind) {
    case 'new-check': return defaults
    case 'retry':
      if (!admission.parentId) throw new Error('Retry admission requires its original check')
      return { ...defaults, parentId: admission.parentId, retryParent: true, skipUsageCount: true }
    case 'update':
      if (!admission.parentId || !['metered', 'included'].includes(admission.allowance)) throw new Error('Invalid update admission')
      return { ...defaults, parentId: admission.parentId, recheckTrigger: admission.trigger,
        skipUsageCount: admission.allowance === 'included', verificationAttemptId: admission.verificationAttemptId }
    case 'site-run': {
      if (!admission.request.id || !admission.executionSpec) throw new Error('Site admission requires its request and specification')
      const scope = admission.executionSpec.scope, watch = admission.request.source === 'WATCH'
      return { ...defaults, parentId: admission.parentId, recheckTrigger: watch ? 'WATCH' as const : 'MANUAL' as const,
        skipUsageCount: watch || !['SITE', 'CATEGORY'].includes(scope), reuseActiveManual: false,
        verificationAttemptId: admission.executionSpec.verificationTarget?.attemptId ?? admission.verificationAttemptId,
        runRequestId: admission.request.id, runRequestAdmission: admission.request, executionSpec: admission.executionSpec,
        scheduledClaim: admission.scheduledClaim, operator: admission.operator }
    }
    default: throw new Error('Explicit audit admission is required')
  }
}
