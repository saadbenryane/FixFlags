import { createHmac } from 'node:crypto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const accept = vi.hoisted(() => vi.fn())
vi.mock('@/lib/email/delivery-events', () => ({ acceptEmailProviderEvent: accept }))
import { POST } from '../route'

const key = Buffer.alloc(32, 7), secret = 'whsec_' + key.toString('base64')
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('RESEND_DELIVERY_WEBHOOK_SECRET', secret) })
afterEach(() => vi.unstubAllEnvs())
function request(payload: string, timestamp = Math.floor(Date.now() / 1000), body = payload) {
  const id = 'msg_fixture', signed = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')
  return new Request('https://fixflags.example/api/webhooks/resend/delivery', { method: 'POST', body,
    headers: { 'svix-id': id, 'svix-timestamp': String(timestamp), 'svix-signature': 'v1,' + signed } })
}
it('accepts only a fresh signature over the original request bytes', async () => {
  const payload = JSON.stringify({ type: 'email.delivered', data: { email_id: 'provider-id' } })
  expect((await POST(request(payload))).status).toBe(200)
  expect(accept).toHaveBeenCalledWith('msg_fixture', payload)
  accept.mockClear()
  expect((await POST(request(payload, undefined, payload + ' '))).status).toBe(400)
  expect((await POST(request(payload, Math.floor(Date.now() / 1000) - 301))).status).toBe(400)
  expect(accept).not.toHaveBeenCalled()
})
it('bounds request size, rejects malformed JSON and retries failed persistence', async () => {
  expect((await POST(request('x'.repeat(65_537)))).status).toBe(413)
  expect((await POST(request('{'))).status).toBe(400)
  accept.mockRejectedValueOnce(new Error('Database temporarily unavailable'))
  expect((await POST(request('{}'))).status).toBe(503)
  vi.stubEnv('RESEND_DELIVERY_WEBHOOK_SECRET', '')
  expect((await POST(request('{}'))).status).toBe(503)
})
