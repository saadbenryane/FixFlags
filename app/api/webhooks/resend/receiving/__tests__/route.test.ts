import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
const accepted = vi.hoisted(() => vi.fn())
vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/sites/accounts/inbox', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/sites/accounts/inbox')>(), acceptReceivingEmail: accepted }))
import { POST } from '../route'
const key = Buffer.alloc(32, 8)
function request(payload: string, signed = true) {
  const timestamp = String(Math.floor(Date.now() / 1000)), id = 'msg_example'
  const signature = createHmac('sha256', key).update(`${id}.${timestamp}.${payload}`).digest('base64')
  return new Request('https://fixflags.example/api/webhooks/resend/receiving', { method: 'POST', body: payload,
    headers: { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': signed ? `v1,${signature}` : 'v1,invalid' } })
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('RESEND_RECEIVING_WEBHOOK_SECRET', `whsec_${key.toString('base64')}`); vi.stubEnv('RESEND_API_KEY', 'test-key') })
describe('Resend receiving route', () => {
  it('rejects unsigned or tampered input before processing', async () => {
    expect((await POST(request('{}', false))).status).toBe(400); expect(accepted).not.toHaveBeenCalled()
  })
  it('rejects malformed signed JSON and ignores other signed event types', async () => {
    expect((await POST(request('invalid'))).status).toBe(400)
    expect((await POST(request('{"type":"email.sent"}'))).status).toBe(200); expect(accepted).not.toHaveBeenCalled()
  })
  it('retries provider failures instead of acknowledging lost verification', async () => {
    const body = JSON.stringify({ type: 'email.received', data: { email_id: 'f00e8c11-567c-4b3c-a970-45b4db22de4f', to: ['checks@example.com'] } })
    accepted.mockRejectedValueOnce(new Error('Temporary failure'))
    expect((await POST(request(body))).status).toBe(503)
  })
})
