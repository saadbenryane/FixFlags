import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotificationEmail } from '../notification-delivery'
import { createQueueRedis } from '@/lib/queue/redis'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

run('shared email provider capacity through Redis and the installed SDK', () => {
  beforeEach(() => {
    const database = new URL(process.env.DATABASE_URL!)
    const redisUrl = new URL(process.env.REDIS_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname) ||
      !['localhost', '127.0.0.1'].includes(redisUrl.hostname)) throw new Error('Use the disposable execution verifier')
  })
  it('paces separate web and worker clients together without changing notification bodies or keys', async () => {
    const requests: Array<{ at: number; body: unknown; key: string | null }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, options?: RequestInit) => {
      if (String(input) !== 'https://api.resend.com/emails') throw new Error('External provider unavailable in this fixture')
      requests.push({ at: performance.now(), body: JSON.parse(options!.body as string),
        key: new Headers(options!.headers).get('Idempotency-Key') })
      return new Response(JSON.stringify({ id: 'accepted-' + requests.length }), { headers: { 'content-type': 'application/json' } })
    }))
    vi.stubEnv('RESEND_API_KEY', 're_fixture_web_not_a_real_key')
    vi.resetModules()
    const web = (await import('../client')).resend!
    vi.stubEnv('RESEND_API_KEY', 're_fixture_worker_not_a_real_key')
    vi.resetModules()
    const worker = (await import('../client')).resend!
    const message = { from: 'watch@example.test', to: 'owner@example.test', subject: 'Recorded alert',
      html: '<p>Recorded evidence</p>', text: 'Recorded evidence', tags: [] }
    const results = await Promise.all(Array.from({ length: 24 }, (_, index) => index % 2
      ? sendNotificationEmail(worker, message, 'fixture-' + index)
      : web.emails.send(message, { idempotencyKey: 'fixture-' + index }).then(result => result.data?.id)))
    expect(results.every(Boolean)).toBe(true)
    expect(requests).toHaveLength(24)
    expect(new Set(requests.map(request => request.key))).toEqual(new Set(Array.from({ length: 24 }, (_, index) => 'fixture-' + index)))
    for (const request of requests) {
      expect(request.body).toEqual(message)
      expect(requests.filter(other => other.at >= request.at && other.at < request.at + 1000).length).toBeLessThanOrEqual(10)
    }
  }, 15_000)

  it('refuses a stalled Redis admission without sending after the late command completes', async () => {
    const control = createQueueRedis()
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    vi.stubEnv('RESEND_API_KEY', 're_fixture_not_a_real_key')
    vi.resetModules()
    const { resend } = await import('../client')
    try {
      await control.call('CLIENT', 'PAUSE', '6000', 'ALL')
      const startedAt = performance.now()
      await expect(resend!.emails.send({ from: 'sender@example.test', to: 'owner@example.test', subject: 'Alert', html: '<p>Evidence</p>' }))
        .rejects.toThrow('capacity is temporarily unavailable')
      expect(performance.now() - startedAt).toBeLessThan(6500)
      expect(fetch).not.toHaveBeenCalled()
    } finally {
      try { await control.call('CLIENT', 'UNPAUSE') }
      finally { control.disconnect() }
    }
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(fetch).not.toHaveBeenCalled()
  }, 15_000)
})
