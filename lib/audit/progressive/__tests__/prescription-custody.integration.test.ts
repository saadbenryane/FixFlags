import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { withExecutionOwnership } from '@/lib/audit/execution-ownership'
import { mergePrescriptionResults } from '@/lib/audit/persist'
import { freezePrescriptionScope } from '@/lib/audit/prescription-scope'
import { runAiReview } from '@/lib/audit/run-ai-review'
import { beginPrescriptionUsage } from '@/lib/audit/prescription-usage'
import { beginProviderUsage } from '@/lib/audit/provider-usage'
import { persistAuditRunCost } from '@/lib/billing/costs'
import { recordSettledPrescriptionCost } from '../incomplete'
import type { PrescriptionOutput } from '@/lib/audit/judge-prescription-schema'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('prescription custody in PostgreSQL', () => {
  const userId = 'prescription-custody-' + randomUUID(), audits: string[] = []
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'ADMIN' } })
  })
  afterAll(async () => {
    await prisma.audit.deleteMany({ where: { id: { in: audits } } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
  })
  async function fixture(kind: 'prescription' | 'judge' = 'prescription') {
    const token = randomUUID(), now = new Date()
    const audit = await prisma.audit.create({ data: { userId, url: 'https://example.com/', isPublic: false,
      status: kind === 'prescription' ? 'COMPLETED' : 'JUDGING', completedAt: kind === 'prescription' ? now : null,
      triageAt: kind === 'prescription' ? now : null, executionToken: token, executionGeneration: 1,
      flags: { create: [0, 1].map(index => ({ checkId: 'custody-' + index, rubric: 'REACH', severity: 'IMPORTANT',
        problem: 'Recorded title missing', whyItMatters: 'The affected page has no descriptive title.', confidence: 1, evidence: 'Original title observation ' + index, fix: '',
        pageUrl: 'https://example.com/page-' + index, source: 'DETERMINISTIC', position: index })) } }, include: { flags: true } })
    audits.push(audit.id)
    const task = await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:' + kind, scopeKey: 'custody',
      pageUrl: audit.url, source: 'EXECUTION', status: 'RUNNING', workKind: kind, workState: 'RUNNING', workToken: token, workGeneration: 1, workLeaseUntil: new Date(Date.now() + 60_000) } })
    const owner = { auditId: audit.id, taskId: task.id, token, generation: 1 }
    const output = (keys: string[]): PrescriptionOutput => ({ flagPrescriptions: keys.map(flagKey => ({ flagKey,
      evidence: 'Provider explanation must not replace native evidence', whyItMatters: 'Provider interpretation',
      verificationRule: 'Provider rule must not replace native obligations', fix: 'Restore the original title on its affected page.',
      agentPrompt: null, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null })), rubricPrescriptions: [] })
    return { audit, task, owner, output }
  }

  it('prices rejected and successful triage responses once from durable measurements', async () => {
    const f = await fixture('judge')
    await withExecutionOwnership(f.owner, async () => {
      const rejected = await beginProviderUsage(f.audit.id, 'triage', 'gpt-4o-mini')
      await rejected({ model: 'gpt-4o-mini', inputTokens: 20, outputTokens: 5, cacheReadTokens: 3 })
      const accepted = await beginProviderUsage(f.audit.id, 'triage', 'gpt-4o-mini')
      await accepted({ model: 'gpt-4o-mini', inputTokens: 40, outputTokens: 10, cacheReadTokens: 7 })
    })
    const metrics = { phase: 'triage' as const, durationMs: 0, pagespeedCalls: 0,
      llmInputTokens: 40, llmOutputTokens: 10, llmModel: 'gpt-4o-mini' }
    await persistAuditRunCost(f.audit.id, metrics)
    const cost = await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })
    expect(cost).toMatchObject({ triageInputTokens: 60, triageOutputTokens: 15, pricingBasis: 'CONFIGURED_ESTIMATE' })
    // Monetary estimates retain the existing six-decimal database precision.
    expect(cost.triageCostUsd?.toString()).toBe('0.000019')
    await persistAuditRunCost(f.audit.id, metrics)
    expect(await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } }))
      .toMatchObject({ triageInputTokens: 60, triageOutputTokens: 15, triageCostUsd: cost.triageCostUsd })
  })

  it('keeps a triage request unpriced when its task loses response authority', async () => {
    const f = await fixture('judge')
    await withExecutionOwnership(f.owner, async () => {
      const response = await beginProviderUsage(f.audit.id, 'triage', 'gpt-4o-mini')
      await prisma.auditVerifierExecution.update({ where: { id: f.task.id }, data: { workState: 'BLOCKED' } })
      await expect(response({ model: 'gpt-4o-mini', inputTokens: 20, outputTokens: 5 })).rejects.toThrow('no longer owns')
    })
    await persistAuditRunCost(f.audit.id, { phase: 'triage', durationMs: 0, pagespeedCalls: 0,
      llmInputTokens: 0, llmOutputTokens: 0, llmModel: '' })
    expect(await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } }))
      .toMatchObject({ pricingBasis: 'UNPRICED', triageCostUsd: null, llmCostUsd: null })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'triage_provider_response' } })).toBe(0)
  })

  it('reconciles planner and evaluator attempts in the initial subtotal without duplicating retries', async () => {
    const f = await fixture('judge')
    await withExecutionOwnership(f.owner, async () => {
      for (const phase of ['journey_planner', 'journey_evaluator'] as const) {
        const response = await beginProviderUsage(f.audit.id, phase, 'gpt-4o-mini')
        await response({ model: 'gpt-4o-mini', inputTokens: 20, outputTokens: 5 })
      }
      const metrics = { phase: 'triage' as const, durationMs: 0, pagespeedCalls: 0,
        llmInputTokens: 0, llmOutputTokens: 0, llmModel: '' }
      await persistAuditRunCost(f.audit.id, metrics)
      const first = await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })
      expect(first).toMatchObject({ triageInputTokens: 40, triageOutputTokens: 10, pricingBasis: 'CONFIGURED_ESTIMATE' })
      expect(first.triageCostUsd?.toString()).toBe('0.000012')
      await persistAuditRunCost(f.audit.id, metrics)
      expect(await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })).toEqual(first)
      await beginProviderUsage(f.audit.id, 'journey_evaluator', 'gpt-4o-mini')
      await persistAuditRunCost(f.audit.id, metrics)
      expect(await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } }))
        .toMatchObject({ triageInputTokens: 40, triageOutputTokens: 10, triageCostUsd: null, pricingBasis: 'UNPRICED' })
    })
  })

  it('retains usage custody for the compatible Audit-owned pipeline', async () => {
    const f = await fixture('judge')
    await prisma.audit.update({ where: { id: f.audit.id }, data: { executionLeaseUntil: new Date(Date.now() + 60_000) } })
    const owner = { auditId: f.owner.auditId, token: f.owner.token, generation: f.owner.generation }
    await withExecutionOwnership(owner, async () => {
      const response = await beginProviderUsage(f.audit.id, 'triage', 'gpt-4o-mini')
      await response({ model: 'gpt-4o-mini', inputTokens: 10, outputTokens: 2 })
    })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, executionId: f.audit.id, event: 'triage_provider_response' } })).toBe(1)
  })

  it('rejects a changed source at commit without changing any repair guidance', async () => {
    const f = await fixture(), scope = freezePrescriptionScope(f.audit.flags)
    await prisma.flag.update({ where: { id: f.audit.flags[0].id }, data: { evidence: 'A newer observed condition' } })
    await expect(withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0', 'custody-1']), { scope, rubrics: false })))
      .rejects.toThrow('PRESCRIPTION_SCOPE_CHANGED')
    expect(await prisma.flag.count({ where: { auditId: f.audit.id, fix: { not: '' } } })).toBe(0)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'prescription_guidance_committed' } })).toBe(0)
  })

  it('refuses guidance when a concurrent PostgreSQL writer changes evidence after validation', async () => {
    const f = await fixture(), flagId = f.audit.flags[0].id, scope = freezePrescriptionScope(f.audit.flags)
    let unlock!: () => void, locked!: () => void, backend = 0
    const release = new Promise<void>(resolve => { unlock = resolve }), ready = new Promise<void>(resolve => { locked = resolve })
    const competing = prisma.$transaction(async tx => {
      backend = (await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`)[0].pid
      await tx.$queryRaw`SELECT id FROM flags WHERE id = ${flagId} FOR UPDATE`
      locked()
      await release
      await tx.flag.update({ where: { id: flagId }, data: { evidence: 'Concurrent newer source observation' } })
    }, { timeout: 10_000 })
    await ready
    const publishing = withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0', 'custody-1']), { scope, rubrics: false }))
      .then(() => null, error => error as Error)
    try {
      const until = Date.now() + 5000
      let waiting = false
      while (Date.now() < until && !waiting) {
        waiting = (await prisma.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE ${backend} = ANY(pg_blocking_pids(pid))) AS waiting
        `)[0].waiting
        if (!waiting) await new Promise(resolve => setTimeout(resolve, 20))
      }
      expect(waiting, 'The actual publication transaction must contend on the original Flag row').toBe(true)
    } finally { unlock(); await competing }
    expect(await publishing).toMatchObject({ message: 'PRESCRIPTION_SCOPE_CHANGED' })
    expect(await prisma.flag.count({ where: { auditId: f.audit.id, fix: { not: '' } } })).toBe(0)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'prescription_guidance_committed' } })).toBe(0)
  })

  it('commits one batch independently and replays its receipt without another capture or provider request', async () => {
    const f = await fixture()
    // Relation order is not source identity. Exercise a different order from
    // the position-sorted publication read and match every assertion by ID.
    f.audit.flags.sort((left, right) => right.position - left.position)
    const original = f.audit.flags.find(flag => flag.checkId === 'custody-0')!
    const sibling = f.audit.flags.find(flag => flag.checkId === 'custody-1')!
    const scope = freezePrescriptionScope(f.audit.flags, ['custody-0'])
    await withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0']), { scope, rubrics: false }))
    const rows = await prisma.flag.findMany({ where: { auditId: f.audit.id }, orderBy: { position: 'asc' } })
    expect(rows).toHaveLength(2)
    expect(rows.find(flag => flag.id === original.id)).toMatchObject({
      id: original.id, checkId: original.checkId, problem: original.problem,
      evidence: original.evidence, whyItMatters: original.whyItMatters,
      verificationRule: original.verificationRule, confidence: original.confidence,
      causeCertainty: original.causeCertainty, fixConfidence: original.fixConfidence,
      fix: 'Restore the original title on its affected page.',
    })
    expect(rows.find(flag => flag.id === sibling.id)?.fix).toBe('')
    // This audit has no metadata, verdict or screenshot. Only the persisted
    // matching commit can settle replay before any of those dependencies.
    await expect(withExecutionOwnership(f.owner, () => runAiReview(f.audit.id, undefined, ['custody-0'], scope)))
      .resolves.toMatchObject({ inputTokens: 0, outputTokens: 0 })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'prescription_guidance_committed' } })).toBe(1)
    await prisma.flag.update({ where: { id: original.id }, data: { fix: 'A newer independent repair' } })
    await expect(withExecutionOwnership(f.owner, () => runAiReview(f.audit.id, undefined, ['custody-0'], scope)))
      .rejects.toThrow('PRESCRIPTION_SCOPE_CHANGED')
  })

  it('keeps consumption unknown when an in-flight request loses its write authority', async () => {
    const f = await fixture()
    await persistAuditRunCost(f.audit.id, { phase: 'triage', durationMs: 0, pagespeedCalls: 0,
      llmInputTokens: 0, llmOutputTokens: 0, llmModel: 'gpt-4o-mini' })
    await withExecutionOwnership(f.owner, async () => {
      // The provider has been admitted, then its task is exhausted while the
      // external request is in flight. Late customer writes remain forbidden.
      const response = await beginPrescriptionUsage(f.audit.id, 'gpt-4o-mini')
      await prisma.auditVerifierExecution.update({ where: { id: f.task.id }, data: { workState: 'BLOCKED' } })
      await expect(response({ inputTokens: 20, outputTokens: 5, model: 'gpt-4o-mini' }))
        .rejects.toThrow('no longer owns')
    })
    await recordSettledPrescriptionCost(f.audit.id)
    expect(await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } }))
      .toMatchObject({ pricingBasis: 'UNPRICED', prescriptionCostUsd: null, llmCostUsd: null })
  })

  it('retains response consumption from rejected attempts and reconciles costs once across replay', async () => {
    const f = await fixture()
    await persistAuditRunCost(f.audit.id, { phase: 'triage', durationMs: 0, pagespeedCalls: 0,
      llmInputTokens: 0, llmOutputTokens: 0, llmModel: 'gpt-4o-mini' })
    await withExecutionOwnership(f.owner, async () => {
      const rejected = await beginPrescriptionUsage(f.audit.id, 'gpt-4o-mini')
      await rejected({ inputTokens: 20, outputTokens: 5, model: 'gpt-4o-mini' })
      const accepted = await beginPrescriptionUsage(f.audit.id, 'gpt-4o-mini')
      await accepted({ inputTokens: 40, outputTokens: 10, model: 'gpt-4o-mini' })
    })
    await prisma.auditVerifierExecution.update({ where: { id: f.task.id }, data: { workState: 'BLOCKED', workErrorCode: 'AI_CONTRACT_INVALID' } })
    await recordSettledPrescriptionCost(f.audit.id)
    const cost = await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })
    expect(cost).toMatchObject({ prescriptionInputTokens: 60, prescriptionOutputTokens: 15 })
    expect(cost.prescriptionCostUsd?.toString()).toBe('0.000018')
    await recordSettledPrescriptionCost(f.audit.id)
    expect(await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })).toEqual(cost)
  })
})
