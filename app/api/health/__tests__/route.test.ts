import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/env', () => ({
  isProdStorageConfigured: () => true,
  isAiProviderConfigured: () => false,
}))
vi.mock('@/lib/billing/config', () => ({ isBillingFullyConfigured: () => true }))
vi.mock('@/lib/audit/llm-keys', () => ({ getOpenAIProviderKey: () => undefined }))
vi.mock('@/lib/audit/judge-config', () => ({
  getJudgeProviderChain: () => ['openai'],
  getConfiguredJudgeProviderChain: () => [],
}))
vi.mock('@/lib/audit/pipeline-config', () => ({ PIPELINE_VERSION: 'test' }))
vi.mock('@/lib/audit/project-watch', () => ({
  productWatchReadiness: () => ({ available: true }),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  getRateLimitRedisHealth: () => ({ redisDown: false }),
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$queryRaw.mockResolvedValue([{ '?column?': 1 }])
  })

  it('returns 200 when the database is reachable', async () => {
    const { GET } = await import('../route')
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
    expect(body.database).toBe('ok')
    expect(body.degraded).toContain('ai')
  })

  it('returns 503 when the database is unavailable', async () => {
    prismaMock.$queryRaw.mockRejectedValue(new Error('db down'))
    const { GET } = await import('../route')
    const response = await GET()
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.database).toBe('error')
  })
})
