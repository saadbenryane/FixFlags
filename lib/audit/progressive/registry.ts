import type { Audit, AuditVerifierExecution } from '@prisma/client'
import type { TaskArtifact, TaskInput, TaskKind } from './contracts'
import type { Prisma } from '@prisma/client'

export type TaskContext = {
  audit: Audit; task: AuditVerifierExecution; input: TaskInput; deadline: number;
  dependencies: Map<string, AuditVerifierExecution>;
}
export type TaskHandler = {
  kind: TaskKind; replay: 'read_only' | 'idempotent' | 'protected';
  timeoutMs: number; evaluate(context: TaskContext): Promise<TaskArtifact>;
  validateResult(artifact: TaskArtifact): void;
  commit?(context: TaskContext, artifact: TaskArtifact, tx: Prisma.TransactionClient): Promise<void>;
  reconcile?(context: TaskContext): Promise<boolean>;
}
export function registerTaskHandlers(definitions: TaskHandler[]) {
  const handlers = new Map<TaskKind, TaskHandler>()
  for (const definition of definitions) {
    if (handlers.has(definition.kind) || typeof definition.evaluate !== 'function' ||
      typeof definition.validateResult !== 'function' || !Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0)
      throw new Error('Invalid task registration: ' + definition.kind)
    handlers.set(definition.kind, definition)
    if (definition.replay === 'protected' && !definition.reconcile) throw new Error('Protected execution requires effect reconciliation')
  }
  return handlers
}
