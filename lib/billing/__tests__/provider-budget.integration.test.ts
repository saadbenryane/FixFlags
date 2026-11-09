import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { reserveProviderBudget, settleProviderBudget, deleteExpiredProviderWindows, providerBudgetConfiguration } from '../provider-budget'
import { boundProviderRequest } from '@/lib/audit/provider-request-bound'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('atomic operational provider admission', () => {
  const day = new Date('2041-11-05T12:00:00.000Z'), prefix = randomUUID()
  const scope = (index: string) => ({ runId: `${prefix}:${index}`, siteId: prefix })
  const bound = { ...boundProviderRequest('gpt-4o-mini', 'chat.completions', { max_tokens: 100 }), maxCostUsd: 0.6 }
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  beforeEach(async () => {
    vi.stubEnv('LLM_BUDGET_MODE', 'application')
    vi.stubEnv('LLM_BUDGET_DAILY_USD', '1')
    vi.stubEnv('LLM_BUDGET_SITE_DAILY_USD', '1')
    vi.stubEnv('LLM_BUDGET_RUN_USD', '1')
    await prisma.providerSpendWindow.deleteMany({ where: { OR: [{ key: { contains: prefix } }, { key: 'day:2041-11-05' }] } })
  })
  afterAll(async () => {
    await prisma.providerSpendWindow.deleteMany({ where: { OR: [{ key: { contains: prefix } }, { key: 'day:2041-11-05' }] } })
    vi.unstubAllEnvs()
  })
  const ownWindows = { OR: [{ key: { contains: prefix } }, { key: 'day:2041-11-05' }] }
  const reserve = (id: string) => prisma.$transaction(tx => reserveProviderBudget(tx, scope(id), bound, day))
  it('records provider-managed admission without requiring duplicate app limits or inventing a dollar cap', async () => {
    vi.stubEnv('LLM_BUDGET_MODE', 'provider')
    for (const name of ['LLM_BUDGET_DAILY_USD', 'LLM_BUDGET_SITE_DAILY_USD', 'LLM_BUDGET_RUN_USD']) vi.stubEnv(name, '')
    expect(providerBudgetConfiguration()).toEqual({ configured: true, mode: 'provider' })
    const allocation = await prisma.$transaction(tx => reserveProviderBudget(tx, scope('provider'), { ...bound, pricing: null, maxCostUsd: null }, day))
    expect(allocation).toEqual({ mode: 'provider', keys: [], reservedMicros: 0, limitsMicros: [] })
    vi.stubEnv('LLM_BUDGET_MODE', 'application')
    await prisma.$transaction(tx => settleProviderBudget(tx, allocation, 0.2))
    expect(await prisma.providerSpendWindow.count({ where: ownWindows })).toBe(0)
  })
  it('refuses an invalid mode rather than silently dropping configured controls', async () => {
    vi.stubEnv('LLM_BUDGET_MODE', 'misspelled')
    expect(providerBudgetConfiguration().configured).toBe(false)
    await expect(reserve('invalid')).rejects.toThrow('LLM_BUDGET_MODE must be')
  })
  it('serializes competing admissions and retains an unknown request across later admission', async () => {
    const results = await Promise.allSettled([reserve('one'), reserve('two')])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    const allocation = (results.find(result => result.status === 'fulfilled') as PromiseFulfilledResult<Awaited<ReturnType<typeof reserve>>>).value
    await prisma.$transaction(tx => settleProviderBudget(tx, allocation, null))
    await expect(reserve('three')).rejects.toThrow('fully reserved or consumed')
    for (const key of allocation.keys) expect(await prisma.providerSpendWindow.findUniqueOrThrow({ where: { key } }))
      .toMatchObject({ reservedMicros: 600000n, settledMicros: 0n })
    await prisma.$transaction(tx => settleProviderBudget(tx, allocation, 0.2))
    await reserve('three')
    expect(await prisma.providerSpendWindow.findUniqueOrThrow({ where: { key: 'day:2041-11-05' } }))
      .toMatchObject({ reservedMicros: 600000n, settledMicros: 200000n })
  })
  it.each(['LLM_BUDGET_DAILY_USD', 'LLM_BUDGET_SITE_DAILY_USD', 'LLM_BUDGET_RUN_USD'])('enforces %s independently', async name => {
    vi.stubEnv('LLM_BUDGET_DAILY_USD', '10'); vi.stubEnv('LLM_BUDGET_SITE_DAILY_USD', '10'); vi.stubEnv('LLM_BUDGET_RUN_USD', '10')
    vi.stubEnv(name, '0.5')
    await expect(reserve('limited')).rejects.toThrow('fully reserved or consumed')
    expect(await prisma.providerSpendWindow.count({ where: ownWindows })).toBe(0)
  })
  it('rolls back reservations if the existing attempt receipt cannot commit', async () => {
    await expect(prisma.$transaction(async tx => {
      await reserveProviderBudget(tx, scope('rollback'), bound, day)
      throw new Error('Controlled receipt persistence failure')
    })).rejects.toThrow('receipt persistence failure')
    expect(await prisma.providerSpendWindow.count({ where: ownWindows })).toBe(0)
  })
  it('refuses a different process allowance instead of silently raising an active window', async () => {
    await reserve('frozen')
    vi.stubEnv('LLM_BUDGET_DAILY_USD', '100')
    await expect(reserve('drifted')).rejects.toThrow('frozen admission window')
    expect(await prisma.providerSpendWindow.findUniqueOrThrow({ where: { key: 'day:2041-11-05' } }))
      .toMatchObject({ limitMicros: 1000000n, reservedMicros: 600000n })
  })
  it('denies missing configuration and unknown prices before reserving money', async () => {
    vi.stubEnv('LLM_BUDGET_DAILY_USD', '')
    await expect(reserve('missing')).rejects.toThrow('Configure LLM_BUDGET_DAILY_USD')
    await expect(prisma.$transaction(tx => reserveProviderBudget(tx, scope('unknown'), { ...bound, maxCostUsd: null }, day)))
      .rejects.toThrow('no configured price bound')
    expect(await prisma.providerSpendWindow.count({ where: ownWindows })).toBe(0)
  })
  it('settles against the admitted UTC window even after the next day begins', async () => {
    const allocation = await reserve('midnight')
    await prisma.$transaction(tx => reserveProviderBudget(tx, scope('tomorrow'), bound, new Date('2041-11-06T00:01:00.000Z')))
    vi.stubEnv('LLM_BUDGET_MODE', 'provider')
    await prisma.$transaction(tx => settleProviderBudget(tx, allocation, 0.1))
    expect(await prisma.providerSpendWindow.findUniqueOrThrow({ where: { key: 'day:2041-11-05' } }))
      .toMatchObject({ reservedMicros: 0n, settledMicros: 100000n })
    expect(await prisma.providerSpendWindow.findUniqueOrThrow({ where: { key: 'day:2041-11-06' } }))
      .toMatchObject({ reservedMicros: 600000n, settledMicros: 0n })
    await prisma.providerSpendWindow.deleteMany({ where: { key: 'day:2041-11-06' } })
  })
  it('prunes settled expired counters while retaining unknown consumption', async () => {
    const allocation = await reserve('retention')
    const future = new Date('2042-01-01T00:00:00.000Z')
    await deleteExpiredProviderWindows(future)
    expect(await prisma.providerSpendWindow.count({ where: ownWindows })).toBe(3)
    await prisma.$transaction(tx => settleProviderBudget(tx, allocation, 0.1))
    await deleteExpiredProviderWindows(future)
    expect(await prisma.providerSpendWindow.count({ where: ownWindows })).toBe(0)
  })
})
