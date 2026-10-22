import type { z } from 'zod'
import { CHECK_MODULES, CHECK_REGISTRY } from '../check-registry'
import type { checkReceiptSchema } from '../checks/receipt'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { TaskFailure } from './contracts'

type CheckExecution = NonNullable<z.infer<typeof checkReceiptSchema>['execution']>

/** A collector can establish only the admitted methods that this runtime implements. */
export function admittedCheckVersions(executionSpec: unknown, module: string): Record<string, number> {
  const selected = Object.entries(readExecutionSpec(executionSpec)?.checks ?? {})
    .filter(([id]) => CHECK_REGISTRY[id]?.module === module)
  if (selected.some(([id, version]) => CHECK_REGISTRY[id].version !== version))
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
