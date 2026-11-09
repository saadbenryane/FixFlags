import { randomUUID } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import OpenAI from 'openai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { beginChatProviderUsage, finalizeChatUsage, getChatAllowance, releaseChatUsage, reserveChatUsage } from '../chat-usage'
import { boundProviderRequest } from '@/lib/audit/provider-request-bound'
import { runWorkspaceChat } from '@/lib/workspace/chat'

const settings = vi.hoisted(() => ({ client: null as OpenAI | null, gateway: false }))
vi.mock('@/lib/audit/judge-runner', () => ({ get openai() { return settings.client } }))
vi.mock('@/lib/audit/judge-config', () => ({ getChatProviderConfig: () => ({ model: 'gpt-4o-mini', maxTokens: 600, timeoutMs: 500 }) }))
vi.mock('@/lib/env', async original => ({ ...await original<typeof import('@/lib/env')>(), getEnv: () => ({ CHAT_BASE_URL: settings.gateway ? 'https://gateway.example' : undefined }) }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('chat provider custody with migrated PostgreSQL', () => {
  let user: { id: string; plan: 'FREE'; role: string; subscriptionStatus: string }
  let server: Server | undefined
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    const created = await prisma.user.create({ data: { email: randomUUID() + '@chat-custody.example' } })
    user = { id: created.id, plan: 'FREE', role: 'user', subscriptionStatus: 'NONE' }
    vi.stubEnv('LLM_BUDGET_MODE', 'application')
    vi.stubEnv('LLM_BUDGET_DAILY_USD', '100')
    vi.stubEnv('LLM_BUDGET_SITE_DAILY_USD', '100')
    vi.stubEnv('LLM_BUDGET_RUN_USD', '100')
    settings.client = null
    settings.gateway = false
  })
  afterEach(async () => {
    settings.client = null
    if (server) {
      server.closeAllConnections()
      await new Promise<void>(resolve => server!.close(() => resolve()))
      server = undefined
    }
    await prisma.user.deleteMany({ where: { id: user.id } })
    vi.unstubAllEnvs()
  })
  const bound = (model: string) => boundProviderRequest(model, 'chat.completions', { model, max_tokens: 600, messages: [{ role: 'user', content: 'Controlled request' }] })
  const read = (id: string) => prisma.chatUsageReservation.findUniqueOrThrow({ where: { id } })
  const reserve = async (now?: Date) => {
    const result = await reserveChatUsage(user, 10_000, now)
    if (!result.reservationId) throw new Error('Expected reserved allowance')
    return result.reservationId
  }
  const measurement = { model: 'gpt-4o-mini', provider: 'openai' as const, api: 'chat.completions' as const,
    serviceTier: 'default', inputTokens: 40, cacheReadTokens: 80, cacheWriteTokens: 0, outputTokens: 18 }

  it('keeps measured and unknown chat custody when spending is managed at the provider', async () => {
    vi.stubEnv('LLM_BUDGET_MODE', 'provider')
    settings.gateway = true
    const id = await reserve()
    const record = await beginChatProviderUsage(id, measurement.model, bound(measurement.model), null)
    expect(await read(id)).toMatchObject({ status: 'REQUESTED', providerUsage: {
      budget: { mode: 'provider' }, request: { maxCostUsd: null, pricing: null }, usage: null } })
    await record(null)
    expect(await getChatAllowance(user)).toMatchObject({ used: 0, reserved: 10_000 })
    await record(measurement)
    expect(await read(id)).toMatchObject({ status: 'FINALIZED', providerUsage: { usage: measurement, estimatedCostUsd: null } })
    expect(await getChatAllowance(user)).toMatchObject({ used: 138, reserved: 0 })
  })

  it('admits one provider attempt across concurrent deliveries and settles it once', async () => {
    const id = await reserve()
    const admitted = await Promise.allSettled([beginChatProviderUsage(id, measurement.model, bound(measurement.model), null), beginChatProviderUsage(id, measurement.model, bound(measurement.model), null)])
    expect(admitted.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(admitted.filter(result => result.status === 'rejected')).toHaveLength(1)
    const record = admitted.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof beginChatProviderUsage>>>
    await Promise.all([record.value(measurement), record.value(measurement), releaseChatUsage(id)])
    expect(await read(id)).toMatchObject({ status: 'FINALIZED', inputTokens: 120, outputTokens: 18,
      providerUsage: { version: 2, model: measurement.model, usage: measurement } })
    expect(((await read(id)).providerUsage as { estimatedCostUsd: number }).estimatedCostUsd).toBeCloseTo(0.0000228, 10)
    expect(await getChatAllowance(user)).toMatchObject({ used: 138, reserved: 0 })
    const event = await prisma.siteLifecycleEvent.findUniqueOrThrow({ where: { idempotencyKey: `agent-usage:${id}` } })
    expect(event.properties).toMatchObject({ inputTokens: 120, outputTokens: 18, cacheReadTokens: 80 })
    expect((event.properties as { estimatedCostUsd: number }).estimatedCostUsd).toBeCloseTo(0.0000228, 10)
  })

  it('preserves unknown consumption through expiry and accepts a late measured response once', async () => {
    const id = await reserve()
    const record = await beginChatProviderUsage(id, measurement.model, bound(measurement.model), null)
    await prisma.chatUsageReservation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1) } })
    expect(await getChatAllowance(user)).toMatchObject({ used: 0, reserved: 10_000 })
    expect(await read(id)).toMatchObject({ status: 'UNKNOWN', providerUsage: { usage: null } })
    await releaseChatUsage(id)
    await record(measurement)
    await record(measurement)
    expect(await getChatAllowance(user)).toMatchObject({ used: 138, reserved: 0 })
  })

  it('expires only undispatched reservations and refuses their later dispatch', async () => {
    const id = await reserve()
    await prisma.chatUsageReservation.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1) } })
    expect(await getChatAllowance(user)).toMatchObject({ used: 0, reserved: 0 })
    expect(await read(id)).toMatchObject({ status: 'EXPIRED', providerUsage: null })
    await expect(beginChatProviderUsage(id, measurement.model, bound(measurement.model), null)).rejects.toThrow('already admitted or its reservation expired')
  })

  it('retains unsupported processing tiers as unpriced instead of estimating a different tier', async () => {
    const id = await reserve()
    await (await beginChatProviderUsage(id, measurement.model, bound(measurement.model), null))({ ...measurement, serviceTier: 'flex' })
    const event = await prisma.siteLifecycleEvent.findUniqueOrThrow({ where: { idempotencyKey: `agent-usage:${id}` } })
    expect(event.properties).toMatchObject({ serviceTier: 'flex', estimatedCostUsd: null })
    expect(await getChatAllowance(user)).toMatchObject({ used: 138, reserved: 0 })
  })

  it('refuses an unpriced gateway before dispatch and preserves the undispatched allowance', async () => {
    settings.gateway = true
    const id = await reserve()
    await expect(beginChatProviderUsage(id, measurement.model, bound(measurement.model), null)).rejects.toThrow('no configured price bound')
    expect(await read(id)).toMatchObject({ status: 'RESERVED', providerUsage: null })
    await releaseChatUsage(id)
    expect(await getChatAllowance(user)).toMatchObject({ used: 0, reserved: 0 })
  })
  it('prices a gateway only from its explicitly configured contract, captured before dispatch', async () => {
    settings.gateway = true
    vi.stubEnv('CHAT_COST_INPUT_PER_MTOK', '2'); vi.stubEnv('CHAT_COST_OUTPUT_PER_MTOK', '4')
    vi.stubEnv('CHAT_COST_CACHE_READ_PER_MTOK', '0.5'); vi.stubEnv('CHAT_COST_CACHE_WRITE_PER_MTOK', '3')
    const id = await reserve()
    const record = await beginChatProviderUsage(id, measurement.model, bound(measurement.model), null)
    vi.stubEnv('CHAT_COST_INPUT_PER_MTOK', '99')
    await record(measurement)
    const row = await read(id)
    expect(row).toMatchObject({ status: 'FINALIZED', providerUsage: { transport: 'gateway',
      request: { pricing: { inputPerMtok: 2 } }, usage: measurement } })
    expect((row.providerUsage as { estimatedCostUsd: number }).estimatedCostUsd).toBeCloseTo(0.000192, 10)
  })

  for (const result of ['missing-usage', 'empty-reply', 'lost-response'] as const) {
    it(`records installed-SDK ${result} before reply publication or cleanup`, async () => {
      const id = await reserve()
      let requests = 0
      let statusAtDispatch: string | undefined
      server = createServer(async (request, response) => {
        for await (const chunk of request) { void chunk }
        requests++
        statusAtDispatch = (await read(id)).status
        if (result === 'lost-response') { response.destroy(); return }
        response.writeHead(200, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ id: 'local-response', model: measurement.model, service_tier: 'default',
          choices: [{ message: { content: result === 'empty-reply' ? '' : 'Read the recorded observation.' } }],
          ...(result === 'empty-reply' ? { usage: { prompt_tokens: 120, completion_tokens: 18,
            prompt_tokens_details: { cached_tokens: 80 } } } : {}) }))
      })
      await new Promise<void>((resolve, reject) => {
        server!.once('error', reject)
        server!.listen(0, '127.0.0.1', () => { server!.off('error', reject); resolve() })
      })
      settings.client = new OpenAI({ apiKey: 'local-only', baseURL: 'http://127.0.0.1:' + (server.address() as { port: number }).port })
      const response = runWorkspaceChat({ message: 'Explain this observation', url: 'https://example.test', status: 'COMPLETED', flags: [] },
        (model, request) => beginChatProviderUsage(id, model, request, null))
      if (result === 'missing-usage') expect((await response).usage).toBeNull()
      else await expect(response).rejects.toThrow('Workspace chat is unavailable')
      await releaseChatUsage(id)
      expect(requests).toBe(1)
      expect(statusAtDispatch).toBe('REQUESTED')
      expect(await read(id)).toMatchObject(result === 'empty-reply'
        ? { status: 'FINALIZED', inputTokens: 120, outputTokens: 18 }
        : { status: 'UNKNOWN', providerUsage: { usage: null } })
      expect(await getChatAllowance(user)).toMatchObject(result === 'empty-reply'
        ? { used: 138, reserved: 0 } : { used: 0, reserved: 10_000 })
      const serialized = JSON.stringify((await read(id)).providerUsage)
      expect(serialized).not.toMatch(/Explain this observation|example.test|Read the recorded observation|local-only/)
      await finalizeChatUsage(id, result === 'empty-reply' ? { inputTokens: 120, outputTokens: 18 } : null)
      expect(await getChatAllowance(user)).toMatchObject(result === 'empty-reply'
        ? { used: 138, reserved: 0 } : { used: 0, reserved: 10_000 })
    })
  }
})
