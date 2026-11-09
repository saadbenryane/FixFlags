import { createHash } from 'node:crypto'
import { currentExecutionOwnership, executionWrite } from '../execution-ownership'
import { canonicalIntent } from '@/lib/sites/domain/execution-spec'
import { readArtifact } from './contracts'
import { sleep } from '@/lib/utils/sleep'

const RETENTION_MS = 30 * 86400_000

/** Reuse only an exact, revalidated interpretation on the existing owned task
 * lineage. Fresh collectors and the native comparison still run independently.
 * A unique scalar coalesces requests, without copying evidence or results. */
export async function exactTriageInterpretation<T>(options: {
  auditId: string
  deadline: number
  input: () => unknown
  evaluate: () => Promise<T>
  readEligible: (value: unknown) => T | null
  reusable: (result: T) => boolean
}): Promise<T> {
  const owner = currentExecutionOwnership()
  if (!owner?.taskId || owner.auditId !== options.auditId) return options.evaluate()
  const taskId = owner.taskId
  const inputHash = createHash('sha256').update(canonicalIntent(options.input())).digest('hex')
  let claimedKey: string | undefined
  for (;;) {
    owner.signal?.throwIfAborted()
    const decision = await executionWrite(async tx => {
      const audit = await tx.audit.findUniqueOrThrow({ where: { id: options.auditId },
        select: { projectId: true, userId: true, executionSpec: true, scanAccessEncrypted: true,
          project: { select: { userId: true, deletedAt: true, user: { select: { lifecycleStatus: true } } } } } })
      if (!audit.projectId || !audit.userId || audit.project?.userId !== audit.userId || audit.project.deletedAt
        || audit.project.user.lifecycleStatus !== 'ACTIVE') return { kind: 'uncacheable' } as const
      const task = await tx.auditExecutionTask.findUniqueOrThrow({ where: { id: taskId }, select: { workKind: true } })
      if (task.workKind !== 'judge') return { kind: 'uncacheable' } as const
      const key = createHash('sha256').update(canonicalIntent({ version: 1, siteId: audit.projectId,
        userId: audit.userId, executionSpec: audit.executionSpec, access: audit.scanAccessEncrypted, inputHash })).digest('hex')
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`triage-interpretation:${key}`}, 0))`
      const source = await tx.auditExecutionTask.findUnique({ where: { interpretationKey: key },
        select: { id: true, auditId: true, workState: true, workLeaseUntil: true, updatedAt: true, workResult: true,
          audit: { select: { projectId: true, userId: true } } } })
      if (source && source.id !== taskId) {
        const sameOwner = source.audit.projectId === audit.projectId && source.audit.userId === audit.userId
        if (sameOwner && source.workState === 'COMPLETED' && source.updatedAt.getTime() > Date.now() - RETENTION_MS) {
          let result: T | null = null
          try { result = options.readEligible(readArtifact(source.workResult, 'judge').data.triage) } catch { /* Invalid retained output is ineligible. */ }
          if (result !== null) {
            await tx.auditExecutionTask.update({ where: { id: taskId }, data: { interpretationSourceId: source.id } })
            await tx.auditPipelineEvent.create({ data: { auditId: options.auditId, executionId: taskId,
              traceId: options.auditId, attempt: owner.generation, stage: 'judging', event: 'triage_interpretation_reused',
              status: 'info', detail: { version: 1, sourceAuditId: source.auditId, sourceTaskId: source.id, interpretationKey: key } } })
            return { kind: 'reused', result } as const
          }
        }
        if (sameOwner && source.workState === 'RUNNING' && source.workLeaseUntil && source.workLeaseUntil > new Date())
          return { kind: 'pending' } as const
        // Expired ownership, changed ownership, invalid output or aged results
        // may release only their index identity. Original evidence is retained.
        await tx.auditExecutionTask.update({ where: { id: source.id }, data: { interpretationKey: null } })
      }
      await tx.auditExecutionTask.update({ where: { id: taskId }, data: { interpretationKey: key, interpretationSourceId: null } })
      return { kind: 'claimed', key } as const
    })
    if (decision.kind === 'reused') return decision.result
    if (decision.kind === 'uncacheable') return options.evaluate()
    if (decision.kind === 'claimed') { claimedKey = decision.key; break }
    if (Date.now() + 500 >= options.deadline) throw new Error('Triage interpretation time budget exhausted while compatible work is in flight')
    await sleep(250, owner.signal)
  }
  let retain = false
  try {
    const result = await options.evaluate()
    retain = options.reusable(result)
    return result
  } finally {
    if (!retain) await executionWrite(tx => tx.auditExecutionTask.updateMany({ where: { id: taskId, interpretationKey: claimedKey },
      data: { interpretationKey: null } }))
  }
}
