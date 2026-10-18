import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { withExecutionOwnership } from '@/lib/audit/execution-ownership'
import { mergePrescriptionResults } from '@/lib/audit/persist'
import { freezePrescriptionScope } from '@/lib/audit/prescription-scope'
import { runAiReview } from '@/lib/audit/run-ai-review'
import { recordPrescriptionUsage } from '@/lib/audit/prescription-usage'
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
  async function fixture() {
    const token = randomUUID(), now = new Date()
    const audit = await prisma.audit.create({ data: { userId, url: 'https://example.com/', isPublic: false,
      status: 'COMPLETED', completedAt: now, triageAt: now, executionToken: token, executionGeneration: 1,
      flags: { create: [0, 1].map(index => ({ checkId: 'custody-' + index, rubric: 'REACH', severity: 'IMPORTANT',
        problem: 'Recorded title missing', whyItMatters: 'The affected page has no descriptive title.', confidence: 1, evidence: 'Original title observation ' + index, fix: '',
        pageUrl: 'https://example.com/page-' + index, source: 'DETERMINISTIC', position: index })) } }, include: { flags: true } })
    audits.push(audit.id)
    const task = await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'task:prescription', scopeKey: 'custody',
      pageUrl: audit.url, source: 'EXECUTION', status: 'RUNNING', workKind: 'prescription', workState: 'RUNNING', workToken: token, workGeneration: 1, workLeaseUntil: new Date(Date.now() + 60_000) } })
    const owner = { auditId: audit.id, taskId: task.id, token, generation: 1 }
    const output = (keys: string[]): PrescriptionOutput => ({ flagPrescriptions: keys.map(flagKey => ({ flagKey,
      evidence: 'Provider explanation must not replace native evidence', whyItMatters: 'Provider interpretation',
      verificationRule: 'Provider rule must not replace native obligations', fix: 'Restore the original title on its affected page.',
      agentPrompt: null, cursorPrompt: null, claudePrompt: null, windsurfPrompt: null, lovablePrompt: null, boltPrompt: null })), rubricPrescriptions: [] })
    return { audit, task, owner, output }
  }

  it('rejects a changed source at commit without changing any repair guidance', async () => {
    const f = await fixture(), scope = freezePrescriptionScope(f.audit.flags)
    await prisma.flag.update({ where: { id: f.audit.flags[0].id }, data: { evidence: 'A newer observed condition' } })
    await expect(withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0', 'custody-1']), { scope, rubrics: false })))
      .rejects.toThrow('PRESCRIPTION_SCOPE_CHANGED')
    expect(await prisma.flag.count({ where: { auditId: f.audit.id, fix: { not: '' } } })).toBe(0)
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'prescription_guidance_committed' } })).toBe(0)
  })

  it('commits one batch independently and replays its receipt without another capture or provider request', async () => {
    const f = await fixture(), scope = freezePrescriptionScope(f.audit.flags, ['custody-0'])
    await withExecutionOwnership(f.owner, () => mergePrescriptionResults(f.audit.id, f.output(['custody-0']), { scope, rubrics: false }))
    const rows = await prisma.flag.findMany({ where: { auditId: f.audit.id }, orderBy: { position: 'asc' } })
    expect(rows[0]).toMatchObject({ evidence: f.audit.flags[0].evidence, fix: 'Restore the original title on its affected page.' })
    expect(rows[1].fix).toBe('')
    // This audit has no metadata, verdict or screenshot. Only the persisted
    // matching commit can settle replay before any of those dependencies.
    await expect(withExecutionOwnership(f.owner, () => runAiReview(f.audit.id, undefined, ['custody-0'], scope)))
      .resolves.toMatchObject({ inputTokens: 0, outputTokens: 0 })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: f.audit.id, event: 'prescription_guidance_committed' } })).toBe(1)
    await prisma.flag.update({ where: { id: rows[0].id }, data: { fix: 'A newer independent repair' } })
    await expect(withExecutionOwnership(f.owner, () => runAiReview(f.audit.id, undefined, ['custody-0'], scope)))
      .rejects.toThrow('PRESCRIPTION_SCOPE_CHANGED')
  })

  it('retains response consumption from rejected attempts and reconciles costs once across replay', async () => {
    const f = await fixture()
    await persistAuditRunCost(f.audit.id, { phase: 'triage', durationMs: 0, pagespeedCalls: 0,
      llmInputTokens: 0, llmOutputTokens: 0, llmModel: 'gpt-4o-mini' })
    await withExecutionOwnership(f.owner, async () => {
      await recordPrescriptionUsage(f.audit.id, { inputTokens: 20, outputTokens: 5, model: 'gpt-4o-mini' }, 'gpt-4o-mini')
      await recordPrescriptionUsage(f.audit.id, { inputTokens: 40, outputTokens: 10, model: 'gpt-4o-mini' }, 'gpt-4o-mini')
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
