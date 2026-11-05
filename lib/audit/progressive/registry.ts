import type { AuditExecutionTask } from '@prisma/client'
import type { TaskArtifact, TaskInput, TaskKind } from './contracts'
import type { Prisma } from '@prisma/client'
import type { NativeHttpEvidence } from '../native-http-evidence'

/** Shared execution metadata, not a copy of the Audit's growing evidence.
 * Handlers read their admitted observations from dependencies or scoped reads. */
export const taskAuditSelect = {
  id: true, url: true, status: true, parentId: true, userId: true, projectId: true, isPublic: true,
  createdAt: true, startedAt: true, recoveryUntil: true, executionSpec: true, includeAi: true,
  productContract: true, reviewDepth: true, scanAccessEncrypted: true,
} satisfies Prisma.AuditSelect
export type TaskAudit = Prisma.AuditGetPayload<{ select: typeof taskAuditSelect }>
export type TaskDependency = Pick<AuditExecutionTask, 'id' | 'auditId' | 'targetKey' | 'workKind' | 'workState' | 'workInput' | 'workResult'>

export type TaskContext = {
  audit: TaskAudit; task: AuditExecutionTask; input: TaskInput; deadline: number;
  dependencies: Map<string, TaskDependency>;
  signal?: AbortSignal;
  replayHttpEvidence?: NativeHttpEvidence;
}
export type TaskHandler = {
  kind: TaskKind; replay: 'read_only' | 'idempotent' | 'protected';
  timeoutMs: number | ((audit: TaskAudit, input: TaskInput) => number); evaluate(context: TaskContext): Promise<TaskArtifact>;
  continuation?: boolean;
  validateResult(artifact: TaskArtifact): void;
  commit?(context: TaskContext, artifact: TaskArtifact, tx: Prisma.TransactionClient): Promise<void | TaskArtifact>;
  reconcile?(context: TaskContext): Promise<boolean>;
}
export function registerTaskHandlers(definitions: TaskHandler[]) {
  const handlers = new Map<TaskKind, TaskHandler>()
  for (const definition of definitions) {
    if (handlers.has(definition.kind) || typeof definition.evaluate !== 'function' ||
      typeof definition.validateResult !== 'function' || typeof definition.timeoutMs !== 'function' &&
      (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0))
      throw new Error('Invalid task registration: ' + definition.kind)
    handlers.set(definition.kind, definition)
    if (definition.replay === 'protected' && !definition.reconcile) throw new Error('Protected execution requires effect reconciliation')
  }
  return handlers
}
