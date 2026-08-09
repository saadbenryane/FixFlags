import { afterEach, describe, expect, it, vi } from 'vitest'

const sendMock = vi.hoisted(() => vi.fn())
const loggerWarn = vi.hoisted(() => vi.fn())
const loggerError = vi.hoisted(() => vi.fn())
const resendHolder = vi.hoisted(() => ({
  current: { emails: { send: sendMock } },
}))

// Live getter: vi.mock factories are evaluated once and cached across
// resetModules, so a static value would never reflect resendHolder changes.
vi.mock('@/lib/email/client', () => ({
  get resend() {
    return resendHolder.current
  },
}))
vi.mock('@/lib/logger', () => ({
  logger: { warn: loggerWarn, error: loggerError, info: vi.fn(), child: vi.fn() },
}))

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
  resendHolder.current = { emails: { send: sendMock } }
})

describe('notifyAdminPaymentFailed', () => {
  it('skips with a warning when no admin email is configured', async () => {
    vi.resetModules()
    vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', '')
    const { notifyAdminPaymentFailed } = await import('@/lib/billing/notify')

    await notifyAdminPaymentFailed({
      userId: 'user-1',
      subscriptionId: 'sub_1',
    })
    expect(sendMock).not.toHaveBeenCalled()
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('ADMIN_NOTIFICATION_EMAIL not set'),
      expect.objectContaining({ userId: 'user-1' })
    )
  })

  it('skips with a warning when Resend is unavailable', async () => {
    resendHolder.current = null as never
    vi.resetModules()
    vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', 'admin@fixflags.dev')
    const { notifyAdminPaymentFailed } = await import('@/lib/billing/notify')

    await notifyAdminPaymentFailed({
      userId: 'user-1',
      subscriptionId: 'sub_1',
    })
    expect(sendMock).not.toHaveBeenCalled()
    expect(loggerWarn).toHaveBeenCalledWith(
      expect.stringContaining('RESEND_API_KEY not set'),
      expect.objectContaining({ userId: 'user-1' })
    )
  })

  it('emails the admin with the failed payment context', async () => {
    vi.resetModules()
    vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', 'admin@fixflags.dev')
    const { notifyAdminPaymentFailed } = await import('@/lib/billing/notify')

    await notifyAdminPaymentFailed({
      userId: 'user-1',
      email: 'owner@example.com',
      subscriptionId: 'sub_1',
    })
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'admin@fixflags.dev',
        subject: expect.stringContaining('payment failed'),
      })
    )
    const html = sendMock.mock.calls[0]?.[0]?.html as string
    expect(html).toContain('user-1')
    expect(html).toContain('owner@example.com')
    expect(html).toContain('sub_1')
  })

  it('logs a send failure without throwing', async () => {
    vi.resetModules()
    vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', 'admin@fixflags.dev')
    sendMock.mockRejectedValueOnce(new Error('resend 500'))
    const { notifyAdminPaymentFailed } = await import('@/lib/billing/notify')

    await expect(
      notifyAdminPaymentFailed({ userId: 'user-1', subscriptionId: 'sub_1' })
    ).resolves.toBeUndefined()
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send payment_failed admin email'),
      expect.objectContaining({ error: 'resend 500' })
    )
  })
})

describe('notifyUserPaymentFailed', () => {
  it('skips when Resend is unavailable', async () => {
    resendHolder.current = null as never
    vi.resetModules()
    const { notifyUserPaymentFailed } = await import('@/lib/billing/notify')

    await notifyUserPaymentFailed({ email: 'owner@example.com' })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('sends the payment-failed email to the user', async () => {
    vi.resetModules()
    const { notifyUserPaymentFailed } = await import('@/lib/billing/notify')

    await notifyUserPaymentFailed({ email: 'owner@example.com', name: 'Owner' })
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.any(String),
      })
    )
  })

  it('logs a send failure without throwing', async () => {
    vi.resetModules()
    sendMock.mockRejectedValueOnce(new Error('resend 500'))
    const { notifyUserPaymentFailed } = await import('@/lib/billing/notify')

    await expect(
      notifyUserPaymentFailed({ email: 'owner@example.com' })
    ).resolves.toBeUndefined()
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('Failed to send payment_failed user email'),
      expect.objectContaining({ email: 'owner@example.com' })
    )
  })
})
