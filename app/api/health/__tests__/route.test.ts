import { afterEach, describe, expect, it, vi } from 'vitest'

const queryRaw = vi.hoisted(() => vi.fn())
const isProdStorageConfigured = vi.hoisted(() => vi.fn())
const isAiProviderConfigured = vi.hoisted(() => vi.fn())
const isBillingFullyConfigured = vi.hoisted(() => vi.fn())
const productWatchReadiness = vi.hoisted(() => vi.fn())
const getRateLimitRedisHealth = vi.hoisted(() => vi.fn())
const getOpenAIProviderKey = vi.hoisted(() => vi.fn())
const getJudgeProviderChain = vi.hoisted(() => vi.fn())
const getConfiguredJudgeProviderChain = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: { $queryRaw: queryRaw } }))
vi.mock('@/lib/env', () => ({ isProdStorageConfigured, isAiProviderConfigured }))
vi.mock('@/lib/billing/config', () => ({ isBillingFullyConfigured }))
vi.mock('@/lib/audit/project-watch', () => ({ productWatchReadiness }))
vi.mock('@/lib/security/rate-limit', () => ({ getRateLimitRedisHealth }))
vi.mock('@/lib/audit/llm-keys', () => ({ getOpenAIProviderKey }))
vi.mock('@/lib/audit/judge-config', () => ({
  getJudgeProviderChain,
  getConfiguredJudgeProviderChain,
}))

const { GET } = await import('../route')
const { resolveCommitSha } = await import('@/lib/health/commit-sha')

function healthyConfig() {
  isProdStorageConfigured.mockReturnValue(true)
  isAiProviderConfigured.mockReturnValue(true)
  isBillingFullyConfigured.mockReturnValue(true)
  productWatchReadiness.mockReturnValue({ available: true })
  getRateLimitRedisHealth.mockReturnValue({ redisDown: false })
  getOpenAIProviderKey.mockReturnValue('sk-test')
  getJudgeProviderChain.mockReturnValue(['openai'])
  getConfiguredJudgeProviderChain.mockReturnValue(['openai'])
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    healthyConfig()
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(body.status).toBe('ok')
    expect(body.database).toBe('ok')
    expect(body.aiConfigured).toBe(true)
    expect(body.billingConfigured).toBe(true)
    expect(body.degraded).toBeUndefined()
  })

  it('lists degraded subsystems without failing the healthcheck', async () => {
    healthyConfig()
    isAiProviderConfigured.mockReturnValue(false)
    isBillingFullyConfigured.mockReturnValue(false)
    productWatchReadiness.mockReturnValue({ available: false })
    getRateLimitRedisHealth.mockReturnValue({ redisDown: true })
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.degraded).toEqual(['ai', 'billing', 'product_watch', 'rate_limit_redis'])
  })

  it('reports storage degradation on production deploys', async () => {
    healthyConfig()
    vi.stubEnv('NODE_ENV', 'production')
    isProdStorageConfigured.mockReturnValue(false)
    queryRaw.mockResolvedValueOnce([{ '?column?': 1 }])

    const response = await GET()
    const body = await response.json()
    expect(body.storageConfigured).toBe(false)
    expect(body.degraded).toContain('storage')
  })

  it('returns 503 with an error database status when the probe fails', async () => {
    healthyConfig()
    queryRaw.mockRejectedValueOnce(new Error('connection refused'))

    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.ok).toBe(false)
    expect(body.status).toBe('error')
    expect(body.database).toBe('error')
  })

  it('reports only a full deployed commit SHA', () => {
    const sha = 'a'.repeat(40)
    expect(resolveCommitSha({ RAILWAY_GIT_COMMIT_SHA: sha })).toBe(sha)
    expect(resolveCommitSha({ GIT_COMMIT_SHA: sha.toUpperCase() })).toBe(sha)
    expect(resolveCommitSha({ RAILWAY_GIT_COMMIT_SHA: sha.slice(0, 7) })).toBeNull()
    expect(resolveCommitSha({ RAILWAY_GIT_COMMIT_SHA: sha.slice(0, 7), GIT_COMMIT_SHA: sha })).toBe(sha)
    expect(resolveCommitSha({})).toBeNull()
  })
})
