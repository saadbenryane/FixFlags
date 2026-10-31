import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { sendNurtureEmail } from '../send'
import { productTipsUnsubscribeUrl, unsubscribeProductTips } from '../unsubscribe'
import { saveNotificationPreferences } from '@/lib/notifications/store'
const provider = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: provider.send } } }))
vi.mock('@/lib/email/recipient', () => ({ isReservedEmailRecipient: () => false }))

const run = process.env.NOTIFICATION_DB_REQUIRED === 'true' ? describe : describe.skip
run('getting-started email consent and durable claims', () => {
  const users: string[] = []
  beforeAll(() => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname)) throw new Error('Disposable notification database required')
    vi.stubEnv('BETTER_AUTH_SECRET', 'fixture-only-notification-signing-secret-32-characters')
  })
  afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: users } } }); users.length = 0; vi.restoreAllMocks() })
  afterAll(async () => { vi.unstubAllEnvs(); await prisma.$disconnect() })
  async function fixture(productTips = false) {
    const id = randomUUID(), email = id + '@notification.test'; users.push(id)
    await prisma.user.create({ data: { id, email, emailVerified: true, name: 'Owner' } })
    await prisma.notificationPreference.create({ data: { userId: id, cadence: 'OFF', productTips } })
    provider.send.mockReset().mockResolvedValue({ data: { id: randomUUID() }, error: null })
    return { id, email }
  }
  it('requires a separate opt-in for product tips and keeps account welcome independent', async () => {
    const { id } = await fixture()
    expect(await sendNurtureEmail(id, 'monitoring')).toMatchObject({ sent: false, reason: 'product_tips_disabled' })
    expect(provider.send).not.toHaveBeenCalled()
    expect(await sendNurtureEmail(id, 'welcome')).toEqual({ sent: true })
    expect(provider.send.mock.calls[0][0].text).toContain('Check your first website')
    expect(provider.send.mock.calls[0][0].headers).toBeUndefined()
  })
  it('admits one competing send, with matching text and signed one-click headers', async () => {
    const { id, email } = await fixture(true)
    await Promise.all([sendNurtureEmail(id, 'monitoring'), sendNurtureEmail(id, 'monitoring')])
    expect(provider.send).toHaveBeenCalledOnce()
    const message = provider.send.mock.calls[0][0]
    expect(message.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
    expect(message.headers['List-Unsubscribe']).toBe(`<${productTipsUnsubscribeUrl(id, email)}>`)
    expect(message.html).toContain('Stop product tips')
    expect(message.text).toContain('Stop product tips')
    expect(await prisma.emailLog.findFirst({ where: { userId: id } })).toMatchObject({ status: 'SENT', attempts: 1 })
  })
  it('retains the exact body and delivery key when retrying a failed send', async () => {
    const { id } = await fixture(true)
    provider.send.mockResolvedValueOnce({ data: null, error: { message: 'Uncertain response' } })
    await sendNurtureEmail(id, 'monitoring')
    const first = provider.send.mock.calls[0]
    await prisma.emailLog.updateMany({ where: { userId: id }, data: { nextAttemptAt: new Date(0) } })
    await prisma.user.update({ where: { id }, data: { name: 'Changed name' } })
    expect(await sendNurtureEmail(id, 'monitoring')).toEqual({ sent: true })
    expect(provider.send.mock.calls[1][0]).toEqual(first[0])
    expect(provider.send.mock.calls[1][1].idempotencyKey).toEqual(first[1].idempotencyKey)
  })
  it('disables only tips and preserves the summary schedule and revision', async () => {
    const { id, email } = await fixture(true)
    const next = new Date(Date.now() + 3600_000)
    await prisma.notificationPreference.update({ where: { userId: id }, data: { cadence: 'DAILY', nextSendAt: next, revision: 7 } })
    const token = new URL(productTipsUnsubscribeUrl(id, email)).searchParams.get('token')!
    expect(await unsubscribeProductTips(token)).toBe(true)
    expect(await prisma.notificationPreference.findUnique({ where: { userId: id } })).toMatchObject({ cadence: 'DAILY', nextSendAt: next, revision: 7, productTips: false })
    expect(await sendNurtureEmail(id, 'monitoring')).toMatchObject({ sent: false, reason: 'product_tips_disabled' })
    expect(provider.send).not.toHaveBeenCalled()
  })
  it('cannot use an old unsubscribe link to change a new account address', async () => {
    const { id, email } = await fixture(true)
    const token = new URL(productTipsUnsubscribeUrl(id, email)).searchParams.get('token')!
    await prisma.user.update({ where: { id }, data: { email: randomUUID() + '@notification.test' } })
    await unsubscribeProductTips(token)
    expect(await prisma.notificationPreference.findUnique({ where: { userId: id } })).toMatchObject({ productTips: true })
  })
  it('merges edited preferences without resetting unrelated settings', async () => {
    const { id } = await fixture(true)
    await saveNotificationPreferences(id, { hour: 15 })
    expect(await prisma.notificationPreference.findUnique({ where: { userId: id } })).toMatchObject({ productTips: true, hour: 15, cadence: 'OFF' })
    await saveNotificationPreferences(id, { productTips: false })
    expect(await prisma.notificationPreference.findUnique({ where: { userId: id } })).toMatchObject({ productTips: false, hour: 15, cadence: 'OFF' })
  })
})
