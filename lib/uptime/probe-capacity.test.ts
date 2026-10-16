import { afterEach, describe, expect, it, vi } from 'vitest'
import { publicHttpCapacity } from '@/lib/audit/progressive/capacity'
import { probeUptime } from './probe'
import { safeFetchDocument } from '@/lib/audit/url'

vi.mock('node:dns/promises', () => ({ resolve4: vi.fn(async () => ['93.184.216.34']), resolve6: vi.fn(async () => []) }))

describe('public uptime response timing under worker load', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
  it.each([
    { responseMs: 6000, budgetMs: undefined, result: 'ONLINE', durationMs: 6000, statusCode: 200 },
    { responseMs: 9000, budgetMs: undefined, result: 'FAILED', durationMs: 8000, statusCode: null },
    { responseMs: 6000, budgetMs: 8000, result: 'UNKNOWN', durationMs: 4000, statusCode: null },
  ])('keeps request timing distinct from local waiting: $result', async ({ responseMs, budgetMs, result, durationMs, statusCode }) => {
    vi.useFakeTimers()
    const deadline = budgetMs === undefined ? undefined : Date.now() + budgetMs
    const releases = await Promise.all(Array.from({ length: publicHttpCapacity.capacity }, () => publicHttpCapacity.acquire()))
    const fetch = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response('<html>Website response</html>', { status: 200 })), responseMs)
      options.signal!.addEventListener('abort', () => { clearTimeout(timer); reject(options.signal!.reason) }, { once: true })
    }))
    vi.stubGlobal('fetch', fetch)
    try {
      const observation = probeUptime('https://example.com/', (url, options) => safeFetchDocument(url, { ...options, deadline }))
      expect(publicHttpCapacity.queued).toBe(1)
      await vi.advanceTimersByTimeAsync(4000)
      expect(fetch).not.toHaveBeenCalled()
      releases.forEach(release => release())
      await vi.advanceTimersByTimeAsync(responseMs)
      expect(await observation).toMatchObject({ result, statusCode, durationMs })
      expect(fetch).toHaveBeenCalledOnce()
      expect(publicHttpCapacity.running).toBe(0)
    } finally { releases.forEach(release => release()) }
  })
  it('keeps exhausted local capacity unknown without reporting website response time', async () => {
    const releases = await Promise.all(Array.from({ length: publicHttpCapacity.capacity }, () => publicHttpCapacity.acquire()))
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    try {
      expect(await probeUptime('https://example.com/', (url, options) => safeFetchDocument(url, { ...options, timeoutMs: 20 })))
        .toMatchObject({ result: 'UNKNOWN', reason: 'probe_unavailable', statusCode: null, durationMs: 0 })
      expect(fetch).not.toHaveBeenCalled()
      expect(publicHttpCapacity.queued).toBe(0)
    } finally { releases.forEach(release => release()) }
  })
})
