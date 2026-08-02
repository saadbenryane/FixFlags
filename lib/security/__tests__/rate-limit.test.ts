import { beforeEach, describe, expect, it, vi } from 'vitest'

const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

const redisMock = vi.hoisted(() => ({
  status: 'wait',
  connect: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  on: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: loggerMock,
}))

vi.mock('ioredis', () => ({
  default: class {
    constructor() {
      return redisMock
    }
  },
}))

describe('rate-limit', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    redisMock.connect.mockResolvedValue(undefined)
    redisMock.incr.mockReset()
    redisMock.expire.mockReset()
    redisMock.ttl.mockReset()
    redisMock.connect.mockClear()
  })

  async function getRateLimitModule() {
    vi.resetModules()
    process.env.REDIS_URL = 'redis://127.0.0.1:6379'
    const rateLimitModule = await import('@/lib/security/rate-limit')
    return rateLimitModule
  }

  it('falls back to allow when Redis is unavailable and mode is allow', async () => {
    const { recordRateLimit, getRateLimitRedisHealth } = await getRateLimitModule()

    redisMock.incr.mockResolvedValue(1)
    redisMock.expire.mockResolvedValue(1)

    const up = await recordRateLimit({
      scope: 'x',
      identifier: 'ip',
      limit: 3,
      windowSeconds: 60,
      onRedisDown: 'allow',
    })

    expect(up).toMatchObject({ exceeded: false, currentCount: 1 })
    expect(getRateLimitRedisHealth()).toMatchObject({ redisDown: false })

    redisMock.incr.mockRejectedValueOnce(new Error('down'))
    const failed = await recordRateLimit({
      scope: 'x',
      identifier: 'ip',
      limit: 3,
      windowSeconds: 60,
      onRedisDown: 'allow',
    })

    expect(failed).toMatchObject({ exceeded: false, currentCount: 0 })
    expect(getRateLimitRedisHealth().redisDown).toBe(true)
  })

  it('rejects requests when Redis is unavailable and mode is reject', async () => {
    const {
      recordRateLimit,
      RateLimitUnavailableError,
      getRateLimitRedisHealth,
    } = await getRateLimitModule()

    redisMock.incr.mockRejectedValue(new Error('redis down'))

    await expect(
      recordRateLimit({
        scope: 'x',
        identifier: 'ip',
        limit: 3,
        windowSeconds: 60,
        onRedisDown: 'reject',
      })
    ).rejects.toBeInstanceOf(RateLimitUnavailableError)
    expect(getRateLimitRedisHealth().redisDown).toBe(true)
  })

  it('marks Redis as recovered after a successful request following downtime', async () => {
    const {
      recordRateLimit,
      RateLimitUnavailableError,
      getRateLimitRedisHealth,
    } = await getRateLimitModule()

    redisMock.incr.mockRejectedValueOnce(new Error('down'))

    await expect(
      recordRateLimit({
        scope: 'x',
        identifier: 'ip',
        limit: 3,
        windowSeconds: 60,
        onRedisDown: 'reject',
      })
    ).rejects.toBeInstanceOf(RateLimitUnavailableError)

    redisMock.incr.mockResolvedValue(1)
    redisMock.expire.mockResolvedValue(1)

    const recovered = await recordRateLimit({
      scope: 'x',
      identifier: 'ip',
      limit: 3,
      windowSeconds: 60,
    })

    expect(recovered.currentCount).toBe(1)
    expect(getRateLimitRedisHealth()).toMatchObject({ redisDown: false })
  })
})
