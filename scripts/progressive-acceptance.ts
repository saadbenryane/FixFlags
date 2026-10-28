import assert from 'node:assert/strict'
import { prisma } from '@/lib/db'
import { executeTask, persistTaskPlan, reconcileTasks, loadTasks } from '@/lib/audit/progressive/engine'
import { serializeArtifact, TaskFailure } from '@/lib/audit/progressive/contracts'
import { registerTaskHandlers } from '@/lib/audit/progressive/registry'
import { executionWrite } from '@/lib/audit/execution-ownership'
import { persistDeterministicFlags } from '@/lib/audit/persist'

/** Fault injection against the real ledger, not a substitute for customer or provider proof. */
async function main() {
  const database = new URL(process.env.DATABASE_URL ?? ''), redis = new URL(process.env.REDIS_URL ?? '')
  assert.equal(database.hostname, 'localhost'); assert.equal(database.port, '55433'); assert.equal(database.pathname, '/search_acceptance')
  assert.equal(redis.hostname, 'localhost'); assert.equal(redis.port, '55434')
  const audit = await prisma.audit.create({ data: { url: 'https://example.com/', status: 'CAPTURING', startedAt: new Date(),
    recoveryUntil: new Date(Date.now() + 3_600_000), executionSpec: { version: 1, engine: 'progressive-v1',
      targetUrl: 'https://example.com/', environment: 'production', scope: 'SITE', checks: {}, outcomes: [], verificationTarget: null } } })
  const input = { pageUrl: audit.url, primary: true, position: 0, role: 'primary' }
  await persistTaskPlan(audit.id, [
    { key: 'fast', kind: 'http', scope: 'fast', input, dependencies: [] },
    { key: 'interrupted', kind: 'browser', scope: 'browser', input, dependencies: [] },
    { key: 'failure', kind: 'check', scope: 'check', input, dependencies: ['fast'] },
    { key: 'refusal', kind: 'check', scope: 'refusal', input, dependencies: ['fast'] },
  ])
  const tasks = await loadTasks(audit.id), fast = tasks.find(task => task.targetKey === 'task:fast')!, slow = tasks.find(task => task.targetKey === 'task:interrupted')!
  let unblock!: () => void, started!: () => void
  const gate = new Promise<void>(resolve => { unblock = resolve }), running = new Promise<void>(resolve => { started = resolve })
  const handlers = registerTaskHandlers([
    { kind: 'http', replay: 'read_only', timeoutMs: 5000, validateResult: () => {}, evaluate: async () => serializeArtifact('http', { observed: 'fast public response' }) },
    { kind: 'browser', replay: 'read_only', timeoutMs: 5000, validateResult: () => {}, evaluate: async context => {
      if (context.task.workGeneration === 1) { started(); await gate }
      await executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { progressDetail: 'generation-' + context.task.workGeneration } }))
      return serializeArtifact('browser', { generation: context.task.workGeneration })
    } },
    { kind: 'check', replay: 'read_only', timeoutMs: 5000, validateResult: () => {}, evaluate: async context => {
      if (context.task.scopeKey === 'refusal') throw new TaskFailure('PERMISSION_REFUSED', false)
      return serializeArtifact('check', { verdict: 'failed', expected: 'The fixture responsibility succeeds', observed: 'The fixture responsibility failed' })
    } },
  ])
  const interrupted = executeTask({ auditId: audit.id, taskId: slow.id, generation: 1 }, handlers)
  await running
  await executeTask({ auditId: audit.id, taskId: fast.id, generation: 1 }, handlers)
  const fastResult = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: fast.id } })
  assert.equal(fastResult.workState, 'COMPLETED')
  assert.equal((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: slow.id } })).workState, 'RUNNING')
  assert.equal(await prisma.auditPipelineEvent.count({ where: { auditId: audit.id, event: 'task_observation_committed', executionId: fast.id } }), 1)
  // Simulated process loss: expire its physical lease while its late promise is still alive.
  await prisma.auditExecutionTask.update({ where: { id: slow.id }, data: { workLeaseUntil: new Date(0) } })
  await reconcileTasks(audit.id)
  assert.equal((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: slow.id } })).workState, 'RETRY_WAIT')
  await prisma.auditExecutionTask.update({ where: { id: slow.id }, data: { workRetryAt: new Date(0) } })
  await reconcileTasks(audit.id)
  await executeTask({ auditId: audit.id, taskId: slow.id, generation: 2 }, handlers)
  unblock(); await interrupted
  const replacement = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: slow.id } })
  assert.equal(replacement.workState, 'COMPLETED'); assert.equal(replacement.workGeneration, 2)
  assert.equal((await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).progressDetail, 'generation-2')
  assert.equal(await prisma.auditPipelineEvent.count({ where: { executionId: slow.id, event: 'task_observation_committed' } }), 1)
  await executeTask({ auditId: audit.id, taskId: fast.id, generation: 1 }, handlers)
  assert.equal(await prisma.auditPipelineEvent.count({ where: { executionId: fast.id, event: 'task_observation_committed' } }), 1)
  const customerFailure = (await loadTasks(audit.id)).find(task => task.targetKey === 'task:failure')!
  await executeTask({ auditId: audit.id, taskId: customerFailure.id, generation: 1 }, handlers)
  const observedFailure = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: customerFailure.id } })
  assert.equal(observedFailure.workState, 'COMPLETED')
  assert.equal((observedFailure.workResult as { data: { verdict: string } }).data.verdict, 'failed')
  await executeTask({ auditId: audit.id, taskId: customerFailure.id, generation: 1 }, handlers)
  assert.equal((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: customerFailure.id } })).workAttempts, 1)
  const refusal = (await loadTasks(audit.id)).find(task => task.targetKey === 'task:refusal')!
  await executeTask({ auditId: audit.id, taskId: refusal.id, generation: 1 }, handlers)
  assert.equal((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: refusal.id } })).workState, 'BLOCKED')
  const flag = { checkId: 'og-image-missing', rubric: 'REACH', severity: 'IMPORTANT', problem: 'Fixture preview is missing',
    evidence: 'Recorded fixture fact', fix: 'Add a preview image', confidence: 0.95, source: 'DETERMINISTIC' as const, pageUrl: audit.url }
  await persistDeterministicFlags(audit.id, [flag], {})
  const persisted = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: flag.checkId } })
  await persistDeterministicFlags(audit.id, [flag], {})
  const repeated = await prisma.flag.findFirstOrThrow({ where: { auditId: audit.id, checkId: flag.checkId } })
  assert.equal(repeated.id, persisted.id); assert.equal(await prisma.flag.count({ where: { auditId: audit.id } }), 1)
  assert.deepEqual((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: fast.id } })).workResult, fastResult.workResult)
  // A lease alone cannot permit publication beyond the admitted recovery bound.
  const expired = await prisma.audit.create({ data: { url: audit.url, status: 'CAPTURING',
    recoveryUntil: new Date(Date.now() + 60_000), executionSpec: audit.executionSpec! } })
  await persistTaskPlan(expired.id, [{ key: 'deadline', kind: 'http', scope: 'deadline', input, dependencies: [] }])
  const expiredTask = (await loadTasks(expired.id))[0]
  let releaseDeadline!: () => void, deadlineStarted!: () => void
  const deadlineGate = new Promise<void>(resolve => { releaseDeadline = resolve })
  const deadlineRunning = new Promise<void>(resolve => { deadlineStarted = resolve })
  const deadlineHandlers = registerTaskHandlers([{ kind: 'http', replay: 'read_only', timeoutMs: 5000,
    validateResult: () => {}, evaluate: async () => {
      deadlineStarted(); await deadlineGate
      await executionWrite(tx => tx.audit.update({ where: { id: expired.id }, data: { progressDetail: 'must-not-publish' } }))
      return serializeArtifact('http', { observed: 'too late' })
    } }])
  const late = executeTask({ auditId: expired.id, taskId: expiredTask.id, generation: 1 }, deadlineHandlers)
  await deadlineRunning
  await prisma.audit.update({ where: { id: expired.id }, data: { recoveryUntil: new Date(0) } })
  releaseDeadline(); await late; await reconcileTasks(expired.id)
  assert.equal((await prisma.audit.findUniqueOrThrow({ where: { id: expired.id } })).progressDetail, null)
  assert.equal((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: expiredTask.id } })).workState, 'EXHAUSTED')
  assert.equal(await prisma.auditPipelineEvent.count({ where: { executionId: expiredTask.id, event: 'task_observation_committed' } }), 0)
  await prisma.audit.update({ where: { id: expired.id }, data: { status: 'FAILED', completedAt: new Date(), errorMsg: 'Recovery deadline fencing fixture only.' } })
  await prisma.audit.update({ where: { id: audit.id }, data: { status: 'FAILED', completedAt: new Date(),
    errorMsg: 'Infrastructure-only fixture completed. No website verdict was requested.' } })
  console.log(JSON.stringify({ proof: 'progressive-ledger-fault-injection', auditId: audit.id,
    independentPublication: true, staleWorkerRejected: true, automaticCheckpointRecovery: true, appendOnlyReceipts: true,
    replayIdempotent: true, customerFailureNotRetried: true, permanentRefusalNotRetried: true, stableFlagIdentity: true, recoveryDeadlineFenced: true }))
}
main().then(() => process.exit(0)).catch(error => { console.error(error); process.exit(1) })
