import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { extractVerification, verifyReceivingSignature, acceptReceivingEmail } from '../inbox'
const db = vi.hoisted(() => ({ message: vi.fn(), accounts: vi.fn(), transaction: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { siteAccountMessage: { findUnique: db.message }, siteTestAccount: { findMany: db.accounts }, $transaction: db.transaction } }))

describe('inbound verification', () => {
  it('matches the published Svix signature example and rejects changed or stale payloads', () => {
    const body = '{"event_type":"ping","data":{"success":true}}'
    const headers = new Headers({ 'svix-id': 'msg_loFOjxBNrRLzqYUf', 'svix-timestamp': '1731705121',
      'svix-signature': 'v1,rAvfW3dJ/X/qxhsaXPOyyCGmRKsaKWcsNccKXlIktD0=' })
    const secret = 'whsec_plJ3nmyCDGBKInavdOK15jsl'
    expect(verifyReceivingSignature(body, headers, secret, 1731705121_000)).toBe(true)
    expect(verifyReceivingSignature(body + ' ', headers, secret, 1731705121_000)).toBe(false)
    expect(verifyReceivingSignature(body, headers, secret, 1731706000_000)).toBe(false)
  })
  it('supports signature rotation while requiring a known version', () => {
    const key = Buffer.alloc(32, 4), payload = '{}', time = Math.floor(Date.now() / 1000).toString()
    const signature = createHmac('sha256', key).update(`msg_test.${time}.${payload}`).digest('base64')
    expect(verifyReceivingSignature(payload, new Headers({ 'svix-id': 'msg_test', 'svix-timestamp': time,
      'svix-signature': `v2,invalid v1,${signature}` }), `whsec_${key.toString('base64')}`)).toBe(true)
  })
  it('extracts only same-origin verification destinations and clearly labelled codes', () => {
    const value = extractVerification({ origin: 'https://example.com', html: '<a href="https://example.com/verify?token=secret">Confirm</a><a href="https://evil.example/verify">Confirm</a><a href="https://example.com/delete-account">Delete</a>', text: 'Your verification code is 123456' })
    expect(value.links).toEqual(['https://example.com/verify?token=secret']); expect(value.code).toBe('123456')
    expect(extractVerification({ origin: 'https://example.com', text: 'Order 123456' }).code).toBeNull()
    expect(extractVerification({ origin: 'https://example.com', text: 'Verification code: 123456. Verification code: 654321.' }).code).toBeNull()
  })
  it('deduplicates before retrieving email content', async () => {
    db.message.mockResolvedValueOnce({ id: 'existing' })
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await acceptReceivingEmail({ type: 'email.received', data: { email_id: 'f00e8c11-567c-4b3c-a970-45b4db22de4f', to: ['checks+ff-test@example.com'] } })
    expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals()
  })
  it('ignores unknown or ambiguous recipients before retrieving email', async () => {
    db.message.mockResolvedValue(null); db.accounts.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }])
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const event = { type: 'email.received' as const, data: { email_id: 'f00e8c11-567c-4b3c-a970-45b4db22de4f', to: ['checks+ff-test@example.com'] } }
    await acceptReceivingEmail(event); await acceptReceivingEmail(event)
    expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals()
  })
})
