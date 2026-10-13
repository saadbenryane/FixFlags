import { beforeEach, describe, expect, it, vi } from 'vitest'
const fixture = vi.hoisted(() => ({ user: vi.fn(), existing: vi.fn(), upsert: vi.fn(), update: vi.fn(), send: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: fixture.user },
  emailLog: { findUnique: fixture.existing, upsert: fixture.upsert, update: fixture.update } } }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: fixture.send } } }))
import { sendNurtureEmail } from '../send'
import { isReservedEmailRecipient } from '../recipient'

describe('customer email delivery boundaries', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fixture.existing.mockResolvedValue(null)
    fixture.user.mockResolvedValue({ email: 'owner@fixflags.com', emailVerified: true, name: 'Owner', plan: 'FREE' })
    fixture.send.mockResolvedValue({ data: { id: 'actual-provider-receipt-contract' }, error: null })
  })
  it('does not send marketing messages to an unverified address', async () => {
    fixture.user.mockResolvedValue({ email: 'owner@fixflags.com', emailVerified: false })
    expect(await sendNurtureEmail('user', 'welcome')).toEqual({ sent: false, reason: 'email_not_verified' })
    expect(fixture.send).not.toHaveBeenCalled()
    expect(fixture.upsert).not.toHaveBeenCalled()
  })
  it('keeps fixture and documentation addresses out of live delivery', async () => {
    for (const domain of ['test', 'invalid', 'localhost', 'example', 'example.com', 'example.net', 'example.org']) {
      expect(isReservedEmailRecipient(`owner@sub.${domain}`)).toBe(true)
      fixture.user.mockResolvedValue({ email: `owner@sub.${domain}`, emailVerified: true })
      expect(await sendNurtureEmail('user', 'welcome')).toEqual({ sent: false, reason: 'reserved_recipient_domain' })
    }
    for (const domain of ['fixflags.com', 'example.company', 'example.com.customer.org'])
      expect(isReservedEmailRecipient(`owner@${domain}`)).toBe(false)
    expect(fixture.send).not.toHaveBeenCalled()
  })
  it('uses a stable provider key and records acceptance only with a receipt', async () => {
    expect(await sendNurtureEmail('user', 'welcome')).toEqual({ sent: true })
    expect(fixture.send).toHaveBeenCalledWith(expect.any(Object), { idempotencyKey: 'fixflags-nurture-user-welcome' })
    expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'SENT', providerId: 'actual-provider-receipt-contract' }) }))
    fixture.update.mockClear()
    fixture.send.mockResolvedValue({ data: {}, error: null })
    expect(await sendNurtureEmail('user', 'welcome')).toEqual({ sent: false, reason: 'Email provider did not confirm acceptance' })
    expect(fixture.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }))
  })
})
