import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { withExecutionOwnership } from '@/lib/audit/execution-ownership'
import { mergePrescriptionResults } from '@/lib/audit/persist'
import { freezePrescriptionScope } from '@/lib/audit/prescription-scope'
import { runAiReview } from '@/lib/audit/run-ai-review'
import { beginPrescriptionUsage } from '@/lib/audit/prescription-usage'
import { beginProviderUsage } from '@/lib/audit/provider-usage'
import { boundProviderRequest } from '@/lib/audit/provider-request-bound'
import { openAIResponseUsage } from '@/lib/audit/provider-request'
import { persistAuditRunCost } from '@/lib/billing/costs'
import { recordSettledPrescriptionCost, settlePrescriptionAudit } from '../incomplete'
import type { PrescriptionOutput } from '@/lib/audit/judge-prescription-schema'
import { observationsForFlag } from '@/lib/audit/flag-observations'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('prescription custody in PostgreSQL', () => {
  const bound = (model: string) => boundProviderRequest(model, 'chat.completions', { model, max_tokens: 4096, messages: [{ role: 'user', content: 'Controlled request' }] })
  const userId = 'prescription-custody-' + randomUUID(), audits: string[] = []
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    vi.stubEnv('LLM_BUDGET_MODE', 'application')
    vi.stubEnv('LLM_BUDGET_DAILY_USD', '100')
    vi.stubEnv('LLM_BUDGET_SITE_DAILY_USD', '100')
    vi.stubEnv('LLM_BUDGET_RUN_USD', '100')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'ADMIN' } })
  })
  afterAll(async () => {
    await prisma.audit.deleteMany({ where: { id: { in: audits } } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await prisma.$disconnect()
    vi.unstubAllEnvs()
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
    const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:' + kind, scopeKey: 'custody',
      pageUrl: audit.url, source: 'EXECUTION', status: 'RUNNING', workKind: kind, workState: 'RUNNING', workToken: token, workGeneration: 1, workLeaseUntil: new Date(Date.now() + 60_000) } })
    const owner = { auditId: audit.id, taskId: task.id, token, generation: 1 }
    const output = (keys: string[]): PrescriptionOutput => ({ flagPrescriptions: keys.map(flagKey => ({ flagKey,
      evidence: 'Provider explanation must not replace native evidence', whyItMatters: 'Provider interpretation',
      verificationRule: 'Provider rule must not replace native obligations', fix: 'Restore the original title on its affected page.',
      agentPrompt: null, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null })), rubricPrescriptions: [] })
    return { audit, task, owner, output }
  }

  it('preserves both phase totals across concurrent settlement and replay', async () => {
    const f = await fixture()
    const metrics = { durationMs: 200, pagespeedCalls: 0, llmModel: 'gpt-6-luna', llmInputTokens: 100, llmOutputTokens: 20 }
    await Promise.all([
      persistAuditRunCost(f.audit.id, { ...metrics, phase: 'triage' }),
      persistAuditRunCost(f.audit.id, { ...metrics, llmInputTokens: 50, llmOutputTokens: 10, phase: 'prescription' }),
    ])
    await persistAuditRunCost(f.audit.id, { ...metrics, phase: 'triage' })
    const recorded = await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })
    expect(recorded).toMatchObject({ triageInputTokens: 100, triageOutputTokens: 20,
      prescriptionInputTokens: 50, prescriptionOutputTokens: 10, llmInputTokens: 150, llmOutputTokens: 30 })
    expect(recorded.estimatedCostUsd).not.toBeNull()
  })

  it.each(['COMPLETED', 'BLOCKED'] as const)('preserves an unrelated analysis failure when guidance settles as %s', async workState => {
    const f = await fixture()
    const failure = { failureCode: 'FINALIZATION_INCOMPLETE' as const, failureStage: 'finalizing',
      errorMsg: 'Recorded results have an incomplete final projection.', failureMetadata: { phase: 'finalization', reason: 'projection_failed' } }
    await prisma.audit.update({ where: { id: f.audit.id }, data: failure })
    await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState,
      workErrorCode: workState === 'BLOCKED' ? 'AI_CONTRACT_INVALID' : null } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    const audit = await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } })
    expect(audit).toMatchObject(failure)
    expect(audit.aiReviewAt === null).toBe(workState !== 'COMPLETED')
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: f.task.id } }))
      .toMatchObject({ workState, workErrorCode: workState === 'BLOCKED' ? 'AI_CONTRACT_INVALID' : null })
  })

  it('clears only its own recorded failure after guidance recovery', async () => {
    const f = await fixture()
    await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'BLOCKED', workErrorCode: 'AI_CONTRACT_INVALID' } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } })).toMatchObject({
      failureCode: 'AI_CONTRACT_INVALID', failureMetadata: { phase: 'prescription', reason: 'AI_CONTRACT_INVALID', version: 1 }, aiReviewAt: null,
    })
    await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'COMPLETED', workErrorCode: null } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } })).toMatchObject({
      failureCode: null, failureStage: null, errorMsg: null, failureMetadata: null, aiReviewAt: expect.any(Date),
    })
  })

  it('prepares native definitions without providers while retaining incomplete assessments and existing editor guidance', async () => {
    const f = await fixture()
    const originalAssessment = { score: null, verdict: null, reportCompleteness: 'PARTIAL' as const,
      failedModules: ['judge'], failureCode: 'AI_CONTRACT_INVALID' as const, failureStage: 'judging',
      failureMetadata: { phase: 'triage', reason: 'semantic_evidence_unavailable' } }
    await prisma.audit.update({ where: { id: f.audit.id }, data: originalAssessment })
    for (const [index, original] of f.audit.flags.entries()) {
      const evidence = `The original HTTP page ${index} has no transport encryption.`
      await prisma.flag.update({ where: { id: original.id }, data: { checkId: 'no-https', evidence,
        ...(index === 0 ? { fix: 'Enable transport encryption on the original HTTP origin while preserving every current path.' } : {}),
        agentPrompt: 'Enable HTTPS on the original HTTP origin and retain its existing paths.',
        cursorPrompt: 'Preserve this existing editor-specific guidance.',
        supportingObservations: observationsForFlag({ source: 'DETERMINISTIC', checkId: 'no-https',
          pageUrl: original.pageUrl!, evidence }, { auditId: f.audit.id, taskId: 'original-http', checkVersion: 1 }) } })
    }
    const flags = await prisma.flag.findMany({ where: { auditId: f.audit.id }, orderBy: { position: 'asc' } })
    const scope = freezePrescriptionScope(flags)
    await expect(withExecutionOwnership(f.owner, () => runAiReview(f.audit.id, undefined, undefined, scope)))
      .resolves.toMatchObject({ inputTokens: 0, outputTokens: 0, model: '' })
    const prepared = await prisma.flag.findMany({ where: { auditId: f.audit.id }, orderBy: { position: 'asc' } })
    expect(prepared.map(flag => ({ ...flag, fix: null }))).toEqual(flags.map(flag => ({ ...flag, fix: null })))
    expect(prepared[0].fix).toBe(flags[0].fix)
    expect(prepared[1].fix).toBe(prepared[1].agentPrompt)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: { endsWith: '_provider_attempt' } } })).toBe(0)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'prescription_native_prepared' } })).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } })).toMatchObject({ ...originalAssessment, aiReviewAt: null })
    await withExecutionOwnership(f.owner, () => runAiReview(f.audit.id, undefined, undefined, scope))
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'prescription_guidance_committed' } })).toBe(1)
    await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'COMPLETED' } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } }))
      .toMatchObject({ ...originalAssessment, aiReviewAt: expect.any(Date) })
  })

  it('does not prepare an unsupported native definition or publish a completion receipt', async () => {
    const f = await fixture(), scope = freezePrescriptionScope(f.audit.flags)
    expect(await withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, 'native-recipe', { scope }))).toBe(false)
    expect(await prisma.flag.count({ where: { auditId: f.audit.id, fix: { not: '' } } })).toBe(0)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'prescription_guidance_committed' } })).toBe(0)
  })

  it('publishes completion after every batch settles without rewriting the original coverage', async () => {
    const f = await fixture()
    const original = { reportCompleteness: 'PARTIAL' as const, failedModules: ['keyboard'],
      evidenceCoverage: { metadata: true, desktopScreenshot: true, mobileScreenshot: false } }
    await prisma.audit.update({ where: { id: f.audit.id }, data: original })
    const sibling = await prisma.auditExecutionTask.create({ data: { auditId: f.audit.id, targetKey: 'task:prescription:1',
      scopeKey: 'custody-sibling', pageUrl: f.audit.url, source: 'EXECUTION', status: 'RUNNING', workKind: 'prescription', workState: 'RUNNING' } })
    await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'COMPLETED' } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } })).toMatchObject({ ...original, aiReviewAt: null })
    await prisma.auditExecutionTask.update({ where: { id: sibling.id }, data: { workState: 'COMPLETED' } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    const completed = await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } })
    expect(completed).toMatchObject({ ...original, status: 'COMPLETED', aiReviewAt: expect.any(Date) })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    expect((await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } })).aiReviewAt).toEqual(completed.aiReviewAt)
  })

  it('publishes complete group guidance from the committed source definitions after independent batches finish', async () => {
    const f = await fixture()
    await prisma.reportRubric.create({ data: { auditId: f.audit.id, name: 'REACH', score: null,
      summary: 'Original assessment summary', rubricPrompt: 'Original incomplete guidance' } })
    const sibling = await prisma.auditExecutionTask.create({ data: { auditId: f.audit.id, targetKey: 'task:prescription:1',
      scopeKey: 'custody-second-guidance', pageUrl: f.audit.url, source: 'EXECUTION', status: 'RUNNING', workKind: 'prescription',
      workState: 'RUNNING', workToken: f.owner.token, workGeneration: 1, workLeaseUntil: new Date(Date.now() + 60_000) } })
    await withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0']),
      { scope: freezePrescriptionScope(f.audit.flags, ['custody-0']) }))
    await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'COMPLETED' } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    expect(await prisma.reportRubric.findFirstOrThrow({ where: { auditId: f.audit.id, name: 'REACH' } }))
      .toMatchObject({ rubricPrompt: 'Original incomplete guidance' })
    await withExecutionOwnership({ ...f.owner, taskId: sibling.id }, () => mergePrescriptionResults(f.audit.id, f.output(['custody-1']),
      { scope: freezePrescriptionScope(f.audit.flags, ['custody-1']) }))
    await prisma.auditExecutionTask.update({ where: { id: sibling.id }, data: { workState: 'COMPLETED' } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    const rubric = await prisma.reportRubric.findFirstOrThrow({ where: { auditId: f.audit.id, name: 'REACH' } })
    expect(rubric).toMatchObject({ score: null, summary: 'Original assessment summary' })
    for (const flag of f.audit.flags) {
      expect(rubric.rubricPrompt).toContain(flag.evidence)
      expect(rubric.rubricPrompt).toContain(flag.pageUrl)
    }
    expect(rubric.rubricPrompt).toContain('Restore the original title')
    expect(rubric.rubricPrompt).not.toContain('Provider interpretation')
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    expect(await prisma.reportRubric.findUniqueOrThrow({ where: { id: rubric.id } })).toEqual(rubric)
  })

  it('does not infer prescription ownership from an AI failure code recorded by another phase', async () => {
    const f = await fixture()
    const failure = { failureCode: 'AI_CONTRACT_INVALID' as const, failureStage: 'judging',
      errorMsg: 'The original triage result is incomplete.', failureMetadata: { phase: 'triage', reason: 'invalid_original_assessment' } }
    await prisma.audit.update({ where: { id: f.audit.id }, data: failure })
    await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'COMPLETED' } })
    await prisma.$transaction(tx => settlePrescriptionAudit(tx, f.audit.id))
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: f.audit.id } })).toMatchObject({ ...failure, aiReviewAt: expect.any(Date) })
  })

  it('prices rejected and successful triage responses once from durable measurements', async () => {
    const f = await fixture('judge')
    await withExecutionOwnership(f.owner, async () => {
      const rejected = await beginProviderUsage(f.audit.id, 'triage', 'gpt-4o-mini', bound('gpt-4o-mini'))
      await rejected({ model: 'gpt-4o-mini', inputTokens: 20, outputTokens: 5, cacheReadTokens: 3 })
      const accepted = await beginProviderUsage(f.audit.id, 'triage', 'gpt-4o-mini', bound('gpt-4o-mini'))
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
      const response = await beginProviderUsage(f.audit.id, 'triage', 'gpt-4o-mini', bound('gpt-4o-mini'))
      await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'BLOCKED' } })
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
        const response = await beginProviderUsage(f.audit.id, phase, 'gpt-4o-mini', bound('gpt-4o-mini'))
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
      await beginProviderUsage(f.audit.id, 'journey_evaluator', 'gpt-4o-mini', bound('gpt-4o-mini'))
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
      const response = await beginProviderUsage(f.audit.id, 'triage', 'gpt-4o-mini', bound('gpt-4o-mini'))
      await response({ model: 'gpt-4o-mini', inputTokens: 10, outputTokens: 2 })
    })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, executionId: f.audit.id, event: 'triage_provider_response' } })).toBe(1)
  })

  it('retains actual provider provenance and cache charges, deduplicating replayed responses without guessing priority prices', async () => {
    const f = await fixture('judge')
    await withExecutionOwnership(f.owner, async () => {
      const response = await beginProviderUsage(f.audit.id, 'triage', 'gpt-6-luna', bound('gpt-6-luna'))
      const usage = openAIResponseUsage({ id: 'controlled-provider-response', model: 'gpt-6-luna', service_tier: 'default',
        usage: { prompt_tokens: 12000, completion_tokens: 1000,
          prompt_tokens_details: { cached_tokens: 4000, cache_write_tokens: 7000 },
          completion_tokens_details: { reasoning_tokens: 300 } } }, 'gpt-6-luna')!
      await response(usage)
      await response(usage)
      const metrics = { phase: 'triage' as const, durationMs: 0, pagespeedCalls: 0,
        llmInputTokens: 0, llmOutputTokens: 0, llmModel: '' }
      await persistAuditRunCost(f.audit.id, metrics)
      const cost = await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })
      expect(cost).toMatchObject({ triageInputTokens: 1000, triageOutputTokens: 1000, pricingBasis: 'CONFIGURED_ESTIMATE' })
      expect(cost.triageCostUsd?.toString()).toBe('0.001515')
      const event = await prisma.auditPipelineEvent.findFirstOrThrow({ where: { auditId: f.audit.id, event: 'triage_provider_response' } })
      expect(event.detail).toMatchObject({ version: 3, usage: { provider: 'openai', api: 'chat.completions', serviceTier: 'default',
        providerResponseId: 'controlled-provider-response', cacheWriteTokens: 7000, reasoningTokens: 300 } })
      const priority = await beginProviderUsage(f.audit.id, 'journey_evaluator', 'gpt-6-luna', bound('gpt-6-luna'))
      await priority({ ...usage, serviceTier: 'priority' })
      await persistAuditRunCost(f.audit.id, metrics)
      expect(await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } }))
        .toMatchObject({ triageInputTokens: 2000, triageOutputTokens: 2000, triageCostUsd: null, pricingBasis: 'UNPRICED' })
    })
  })

  it('rejects a changed source at commit without changing any repair guidance', async () => {
    const f = await fixture(), scope = freezePrescriptionScope(f.audit.flags)
    await prisma.flag.update({ where: { id: f.audit.flags[0].id }, data: { evidence: 'A newer observed condition' } })
    await expect(withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0', 'custody-1']), { scope })))
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
    const publishing = withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0', 'custody-1']), { scope }))
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
    await withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0']), { scope }))
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
      const response = await beginPrescriptionUsage(f.audit.id, 'gpt-4o-mini', bound('gpt-4o-mini'))
      await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'BLOCKED' } })
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
      const rejected = await beginPrescriptionUsage(f.audit.id, 'gpt-4o-mini', bound('gpt-4o-mini'))
      await rejected({ inputTokens: 20, outputTokens: 5, model: 'gpt-4o-mini' })
      const accepted = await beginPrescriptionUsage(f.audit.id, 'gpt-4o-mini', bound('gpt-4o-mini'))
      await accepted({ inputTokens: 40, outputTokens: 10, model: 'gpt-4o-mini' })
    })
    await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'BLOCKED', workErrorCode: 'AI_CONTRACT_INVALID' } })
    await recordSettledPrescriptionCost(f.audit.id)
    const cost = await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })
    expect(cost).toMatchObject({ prescriptionInputTokens: 60, prescriptionOutputTokens: 15 })
    expect(cost.prescriptionCostUsd?.toString()).toBe('0.000018')
    await recordSettledPrescriptionCost(f.audit.id)
    expect(await prisma.auditRunCost.findUniqueOrThrow({ where: { auditId: f.audit.id } })).toEqual(cost)
  })
})
