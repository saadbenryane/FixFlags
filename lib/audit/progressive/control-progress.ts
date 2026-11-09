import { z } from 'zod'
import { readExecutionSpec } from '@/lib/sites/domain/execution-spec'
import { actionContextSchema } from '../flow/action-context'
import { readArtifact, TaskFailure } from './contracts'
import type { TaskContext } from './registry'

export const controlProgressSchema = z.object({ completed: z.number().int().min(1).max(5001),
  total: z.number().int().min(1).max(5001), context: actionContextSchema.nullable() }).strict()

/** Each delivery observes one control. The previous committed checkpoint is
 * authoritative; retries cannot skip, reorder or fabricate earlier progress. */
export function nextControlProgress(context: TaskContext) {
  const contexts = context.input.verificationContexts
  if (!contexts?.length) return null
  const spec = readExecutionSpec(context.audit.executionSpec)
  if (!spec || !['DIAGNOSTIC', 'SITE', 'CATEGORY'].includes(spec.scope)) throw new TaskFailure('CONTROL_SCOPE_INVALID', false)
  const diagnostic = spec.scope === 'DIAGNOSTIC'
  const offset = diagnostic ? 0 : 1, total = contexts.length + offset
  let completed = 0
  if (context.task.workResult !== null) {
    const prior = controlProgressSchema.parse(readArtifact(context.task.workResult, 'flow').data.controlProgress)
    if (prior.total !== total || prior.completed >= total || prior.context !== (prior.completed <= offset ? null : contexts[prior.completed - offset - 1]))
      throw new TaskFailure('CONTROL_CHECKPOINT_INVALID', false)
    completed = prior.completed
  }
  return { completed: completed + 1, total, context: completed < offset ? null : contexts[completed - offset] }
}
