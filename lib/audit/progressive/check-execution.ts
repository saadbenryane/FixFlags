import type { z } from 'zod'
import { executionCheckModule, supportsExecutionCheckVersion } from '../check-registry'
import { CHECK_MODULES } from '../checks/definitions'
import type { checkReceiptSchema } from '../checks/receipt'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { TaskFailure } from './contracts'
import { baseCheckId } from '../flag-identity'

type CheckExecution = NonNullable<z.infer<typeof checkReceiptSchema>['execution']>

/** A collector can establish only the admitted methods that this runtime implements. */
export function admittedCheckVersions(executionSpec: unknown, module: string): Record<string, number> {
  const spec = readExecutionSpec(executionSpec)
  const target = module === 'og-image' && spec?.verificationTarget?.kind === 'DIAGNOSTIC'
    ? baseCheckId(spec.verificationTarget.checkId) : undefined
  const selected = Object.entries(spec?.checks ?? {})
    .filter(([id, version]) => executionCheckModule(id, version) === module && (!target || id === target))
  if (selected.some(([id, version]) => !supportsExecutionCheckVersion(id, version)))
    throw new TaskFailure('CHECK_VERSION_UNAVAILABLE', false)
  return Object.fromEntries(selected)
}

export function checkExecution(
  context: { audit: { id: string; executionSpec: unknown }; task: { id: string } },
  module: string,
  source: CheckExecution['source'],
  collectedAt = new Date().toISOString(),
): CheckExecution {
  const definition = CHECK_MODULES[module]
  if (!definition) throw new TaskFailure('CHECK_NOT_REGISTERED', false)
  return { auditId: context.audit.id, taskId: context.task.id, checkVersion: definition.version,
    checkVersions: admittedCheckVersions(context.audit.executionSpec, module), source, collectedAt }
}
