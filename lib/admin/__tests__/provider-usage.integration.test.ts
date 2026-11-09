import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { adminProviderUsage } from '../provider-usage'
import { boundProviderRequest } from '@/lib/audit/provider-request-bound'
import { measuredProviderRequest, openAIResponseUsage } from '@/lib/audit/provider-request'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('administrator paid probe custody', () => {
  const userId = randomUUID(), sessionId = randomUUID()
  const actor = { id: userId, sessionId, role: 'admin', email: userId + '@probe.example', authenticatedAt: new Date() }
  const body = { model: 'gpt-4o-mini', max_tokens: 5, messages: [{ role: 'user', content: 'ok' }] }
  const bound = boundProviderRequest(body.model, 'chat.completions', body)
  const measurement = openAIResponseUsage({ id: 'controlled-probe', service_tier: 'default', usage: { prompt_tokens: 10, completion_tokens: 2 } }, body.model)!
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.create({ data: { id: userId, email: actor.email, role: 'admin' } })
    await prisma.session.create({ data: { id: sessionId, userId, token: randomUUID(), expiresAt: new Date(Date.now() + 120_000) } })
  })
  beforeEach(() => {
    vi.stubEnv('LLM_BUDGET_MODE', 'application')
    vi.stubEnv('LLM_BUDGET_DAILY_USD', '100'); vi.stubEnv('LLM_BUDGET_SITE_DAILY_USD', '100'); vi.stubEnv('LLM_BUDGET_RUN_USD', '100')
  })
  afterAll(async () => {
    // Operator custody remains append-only even in a fixture. The isolated
    // verifier drops this entire owned database after all checks finish.
    await prisma.user.delete({ where: { id: userId } })
    vi.unstubAllEnvs()
  })
  it('records consumption once under the existing operator operation before returning the probe result', async () => {
    const record = await adminProviderUsage(actor)(body.model, bound)
    const operation = await prisma.adminOperation.findFirstOrThrow({ where: { actorId: userId, status: 'RUNNING' } })
    expect(operation).toMatchObject({ action: 'AI_PROVIDER_VALIDATE', result: { usage: null, request: { bodySha256: bound.bodySha256 } } })
    await Promise.all([record(measurement), record(measurement)])
    const done = await prisma.adminOperation.findUniqueOrThrow({ where: { id: operation.id } })
    expect(done).toMatchObject({ status: 'SUCCEEDED', result: { usage: measurement } })
    const allocation = (done.result as unknown as { budget: { keys: string[] } }).budget
    expect(await prisma.providerSpendWindow.findUniqueOrThrow({ where: { key: allocation.keys.find(key => key.startsWith('run:'))! } }))
      .toMatchObject({ reservedMicros: 0n, settledMicros: 3n })
    expect(await prisma.adminActivityEvent.count({ where: { operationId: done.id, type: 'provider_usage_measured' } })).toBe(1)
    expect(JSON.stringify(done.result)).not.toContain('messages')
  })
  it('keeps an unanswered probe indeterminate with its conservative reservation', async () => {
    const record = await adminProviderUsage(actor)(body.model, bound)
    const operation = await prisma.adminOperation.findFirstOrThrow({ where: { actorId: userId, status: 'RUNNING' } })
    await record(null)
    const done = await prisma.adminOperation.findUniqueOrThrow({ where: { id: operation.id } })
    expect(done).toMatchObject({ status: 'INDETERMINATE', result: { usage: null, estimatedCostUsd: null } })
    const allocation = (done.result as unknown as { budget: { keys: string[]; reservedMicros: number } }).budget
    expect(await prisma.providerSpendWindow.findUniqueOrThrow({ where: { key: allocation.keys.find(key => key.startsWith('run:'))! } }))
      .toMatchObject({ reservedMicros: BigInt(allocation.reservedMicros), settledMicros: 0n })
  })
  it('refuses missing budget and revoked administrator authority before an SDK dispatch', async () => {
    const request = vi.fn(async () => ({ usage: null }))
    const probe = () => measuredProviderRequest({ model: body.model, api: 'chat.completions', requestBody: body,
      onAttempt: adminProviderUsage(actor), request, usage: () => null })
    for (const name of ['LLM_BUDGET_DAILY_USD', 'LLM_BUDGET_SITE_DAILY_USD', 'LLM_BUDGET_RUN_USD']) {
      vi.stubEnv(name, '')
      await expect(probe()).rejects.toThrow('Configure ' + name)
      vi.stubEnv(name, '100')
    }
    await prisma.session.delete({ where: { id: sessionId } })
    await expect(probe()).rejects.toThrow('Administrator access is no longer available')
    expect(request).not.toHaveBeenCalled()
  })
})
