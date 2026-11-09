import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import OpenAI from 'openai'
import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { withExecutionOwnership } from '../../execution-ownership'
import { exactTriageInterpretation } from '../interpretation'
import { serializeArtifact } from '../contracts'
import { parseMetadataFromHtml } from '../../metadata'
import { pageSpeedMeasurementFixture } from '../../__tests__/check-fixtures'

const transport = vi.hoisted(() => ({ client: null as OpenAI | null }))
vi.mock('@/lib/audit/judge-config', async original => ({ ...await original<typeof import('@/lib/audit/judge-config')>(),
  getConfiguredJudgeProviderChain: () => transport.client ? ['openai'] : [],
  getTriageProviderConfig: () => ({ model: 'gpt-4o-mini-2024-07-18', maxTokens: 1500, timeoutMs: 5000, imageDetail: 'low' }),
}))
vi.mock('@/lib/audit/judge-runner', async original => ({ ...await original<typeof import('@/lib/audit/judge-runner')>(),
  get openai() { return transport.client }, anthropic: null, isProviderConfigured: () => Boolean(transport.client),
}))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('exact interpretation on existing task lineage', () => {
  const userId = randomUUID(), projectId = randomUUID()
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.create({ data: { id: userId, email: userId + '@interpretation.example' } })
    await prisma.project.create({ data: { id: projectId, userId, url: 'https://interpretation.example', canonicalHost: 'interpretation.example', name: 'Interpretation fixture' } })
    vi.stubEnv('LLM_BUDGET_MODE', 'application')
    vi.stubEnv('LLM_BUDGET_DAILY_USD', '100'); vi.stubEnv('LLM_BUDGET_SITE_DAILY_USD', '100'); vi.stubEnv('LLM_BUDGET_RUN_USD', '100')
  })
  afterAll(async () => { await prisma.audit.deleteMany({ where: { userId } }); await prisma.user.delete({ where: { id: userId } }); vi.unstubAllEnvs() })
  async function fixture(site = projectId) {
    const audit = await prisma.audit.create({ data: { userId, projectId: site, url: 'https://interpretation.example', status: 'JUDGING' } })
    const token = randomUUID()
    const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:judge', scopeKey: 'product', source: 'EXECUTION',
      workKind: 'judge', status: 'RUNNING', workState: 'RUNNING', workToken: token, workGeneration: 1, workLeaseUntil: new Date(Date.now() + 60_000) } })
    return { audit, task, owner: { auditId: audit.id, taskId: task.id, token, generation: 1 } }
  }
  type Result = { accepted: boolean; conclusion: string }
  const result = { accepted: true, conclusion: 'Source-bound interpretation' }
  const read = (value: unknown): Result | null => value && typeof value === 'object' && 'accepted' in value
    && value.accepted === true && 'conclusion' in value && typeof value.conclusion === 'string' ? value as Result : null
  async function execute(f: Awaited<ReturnType<typeof fixture>>, input: object, evaluate: () => Promise<Result>) {
    return withExecutionOwnership(f.owner, async () => {
      const value = await exactTriageInterpretation({ auditId: f.audit.id, deadline: Date.now() + 20_000,
        input: () => input, evaluate, readEligible: read, reusable: value => value.accepted })
      await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'COMPLETED',
        workResult: serializeArtifact('judge', { triage: value }) } })
      return value
    })
  }
  it('coalesces concurrent identical work and records reuse on the new observation', async () => {
    const a = await fixture(), b = await fixture(), identity = { source: randomUUID(), model: 'pinned-snapshot', text: 'Fresh captured text' }
    let calls = 0, entered!: () => void, finish!: () => void
    const started = new Promise<void>(resolve => { entered = resolve }), gate = new Promise<void>(resolve => { finish = resolve })
    const first = execute(a, identity, async () => { calls++; entered(); await gate; return result })
    await started
    const second = execute(b, identity, async () => { calls++; return result })
    finish()
    expect(await Promise.all([first, second])).toEqual([result, result])
    expect(calls).toBe(1)
    expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: b.task.id } })).toMatchObject({ interpretationSourceId: a.task.id })
    expect(await prisma.auditPipelineEvent.findFirstOrThrow({ where: { auditId: b.audit.id, event: 'triage_interpretation_reused' } }))
      .toMatchObject({ detail: { sourceAuditId: a.audit.id, sourceTaskId: a.task.id } })
  })
  it.each(['text', 'image', 'model', 'policy', 'access', 'completeness'])('requires new interpretation when %s changes', async changed => {
    const a = await fixture(), b = await fixture(), identity = { scope: randomUUID(), text: 'captured', image: 'bytes', model: 'snapshot',
      policy: 1, access: 'public', completeness: 'full' }
    let calls = 0
    const evaluate = async () => { calls++; return result }
    await execute(a, identity, evaluate)
    await execute(b, { ...identity, [changed]: 'changed' }, evaluate)
    expect(calls).toBe(2)
    expect((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: b.task.id } })).interpretationSourceId).toBeNull()
  })
  it('keeps identical inputs private to their Site', async () => {
    const peer = await prisma.project.create({ data: { userId, url: 'https://peer-interpretation.example', canonicalHost: 'peer-interpretation.example', name: 'Peer fixture' } })
    const a = await fixture(), b = await fixture(peer.id), input = { source: randomUUID() }
    let calls = 0
    const evaluate = async () => { calls++; return result }
    await execute(a, input, evaluate); await execute(b, input, evaluate)
    expect(calls).toBe(2)
  })
  it('refuses partial, invalid and aged retained output without altering the original result', async () => {
    for (const state of ['partial', 'invalid', 'aged'] as const) {
      const a = await fixture(), b = await fixture(), input = { source: randomUUID() }
      await execute(a, input, async () => result)
      const original = state === 'partial' ? serializeArtifact('judge', { triage: { ...result, accepted: false } })
        : state === 'invalid' ? { broken: true } : serializeArtifact('judge', { triage: result })
      await prisma.auditExecutionTask.update({ where: { id: a.task.id }, data: { workResult: original,
        ...(state === 'aged' ? { updatedAt: new Date(Date.now() - 31 * 86400_000) } : {}) } })
      let calls = 0
      await execute(b, input, async () => { calls++; return result })
      expect(calls).toBe(1)
      expect((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: a.task.id } })).workResult).toEqual(original)
    }
  })
  it('reuses an installed-SDK interpretation for fresh compatible facts despite new provider timestamps, while partial capture evaluates independently', async () => {
    const { runTriageStep } = await import('../../pipeline/triage-step')
    const url = 'https://interpretation.example', requests: unknown[] = []
    const answer = { pageJob: 'Help teams plan releases', pageType: 'homepage', verdict: 'Recorded review', score: 95,
      launchReadiness: 'safe', launchChecklist: ['https', 'social-preview', 'mobile-cta', 'console-errors', 'privacy-contact']
        .map(id => ({ id, label: id, passed: true })),
      rubrics: ['MESSAGE', 'EXPERIENCE', 'REACH'].map(name => ({ name, score: 95, grade: 'A', status: 'EXCELLENT',
        assessmentState: 'ASSESSED', confidence: 0.95, summary: 'Recorded conditional review.' })),
      newFlags: [{ reviewKind: 'copy-clarity', rubric: 'MESSAGE', device: 'none', impactTag: 'CLARITY', severity: 'IMPORTANT',
        evidenceRefs: [{ source: 'headline', quote: 'Plan releases together' }], pageUrl: null, confidence: 0.9,
        problem: 'Review the recorded headline', evidence: 'Plan releases together', whyItMatters: 'A conditional review.' }] }
    const server = createServer(async (request, response) => {
      const chunks = []; for await (const chunk of request) chunks.push(chunk)
      requests.push(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ id: 'controlled-triage-response-' + requests.length, model: 'gpt-4o-mini-2024-07-18',
        service_tier: 'default', choices: [{ index: 0, message: { role: 'assistant', content: JSON.stringify(answer) }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1500, completion_tokens: 800 } }))
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('Expected loopback address')
    transport.client = new OpenAI({ apiKey: 'controlled-loopback-key', baseURL: `http://127.0.0.1:${address.port}/v1`, maxRetries: 0 })
    try {
      const metadata = parseMetadataFromHtml('<html lang="en"><head><title>Plan releases</title></head><body><main><h1>Plan releases together</h1><p>'
        + 'Product teams coordinate releases and review their recorded work together. '.repeat(10) + '</p><a href="/start">Start free</a></main></body></html>', url)
      metadata.renderedCopy = { version: 1, pageUrl: url, pageText: metadata.pageText, h1s: metadata.h1s, h2s: metadata.h2s, complete: true, textTruncated: false }
      const desktop = pageSpeedMeasurementFixture(url)
      const input = { url, metadata, desktop, mobile: null, flags: [], desktopBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9YGtNwAAAAASUVORK5CYII=',
        mobileBase64: null, completeness: 'FULL' as 'FULL' | 'PARTIAL', observationScope: { pageUrl: url, finalUrl: url, profile: 'controlled-public-desktop', access: 'public' } }
      async function observed(f: Awaited<ReturnType<typeof fixture>>, value = input) {
        return withExecutionOwnership(f.owner, async () => {
          const result = await runTriageStep({ auditId: f.audit.id, deadline: Date.now() + 40_000, startedAt: new Date(),
            clock: { now: () => new Date() }, trace: { executionId: f.task.id, traceId: f.audit.id, attempt: 1 },
            events: { log: vi.fn(async () => undefined) }, pagespeedCalls: 0, usage: { inputTokens: 0, outputTokens: 0, models: [] }, includeAi: true }, value)
          await prisma.auditExecutionTask.update({ where: { id: f.task.id }, data: { workState: 'COMPLETED', status: 'COMPLETED',
            workResult: serializeArtifact('judge', { triage: result }) } })
          return result
        })
      }
      const a = await fixture(), b = await fixture(), partial = await fixture()
      const original = await observed(a)
      const reused = await observed(b, { ...input, desktop: { ...desktop, raw: { ...desktop.raw, fetchTime: 'a fresh native observation timestamp' } } })
      expect(requests).toHaveLength(1)
      expect(reused.output).toEqual(original.output)
      expect(reused.usage).toMatchObject({ inputTokens: 0, outputTokens: 0 })
      expect((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: b.task.id } })).interpretationSourceId).toBe(a.task.id)
      expect(await prisma.auditPipelineEvent.count({ where: { auditId: b.audit.id, event: 'triage_provider_attempt' } })).toBe(0)
      const independent = await observed(partial, { ...input, completeness: 'PARTIAL' })
      expect(requests).toHaveLength(2)
      expect(independent.usage.inputTokens).toBe(1500)
      expect((await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: partial.task.id } })).interpretationSourceId).toBeNull()
    } finally {
      transport.client = null; server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
