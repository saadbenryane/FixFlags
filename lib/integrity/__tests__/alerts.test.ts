import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.hoisted(() => vi.fn())
const fetchMock = vi.hoisted(() => vi.fn())

vi.mock('@/lib/email/client', () => ({
  resend: { emails: { send } },
}))
vi.mock('@/lib/analytics/events', () => ({
  trackEvent: vi.fn(),
}))
vi.mock('@/lib/security/crypto', () => ({
  decryptSecret: (value: string) => value,
}))

import { sendIntegrityAlert } from '@/lib/integrity/alerts'
import { trackEvent } from '@/lib/analytics/events'

describe('sendIntegrityAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockResolvedValue({ ok: true })
  })

  it('does not send email or Slack for UNKNOWN', async () => {
    await sendIntegrityAlert({
      shop: { email: 'owner@example.com', slackWebhookEncrypted: 'https://hooks.slack.com/services/x', name: 'Demo' },
      pathLabel: 'Tee',
      health: 'UNKNOWN',
      reason: 'no_buy_control',
      videoUrl: 'https://cdn.example/walk.webm',
      gifUrl: null,
      screenshotUrl: null,
    })
    expect(send).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(trackEvent).not.toHaveBeenCalled()
  })

  it('sends RED with a proof URL and no Improve advice', async () => {
    await sendIntegrityAlert({
      shop: {
        email: 'owner@example.com',
        slackWebhookEncrypted: 'https://hooks.slack.com/services/x',
        name: 'Demo',
        shopDomain: 'demo.myshopify.com',
      },
      pathLabel: 'Tee',
      health: 'RED',
      reason: 'add_to_cart_noop',
      videoUrl: 'https://cdn.example/walk.webm',
      gifUrl: null,
      screenshotUrl: 'https://cdn.example/step.png',
    })
    expect(send).toHaveBeenCalledTimes(1)
    const payload = send.mock.calls[0]?.[0] as { subject: string; text: string }
    expect(payload.subject).toMatch(/can't buy/i)
    expect(payload.text).toMatch(/Proof: https:\/\/cdn\.example\/walk\.webm/)
    expect(payload.text).not.toMatch(/improve/i)
    expect(trackEvent).toHaveBeenCalledWith('shopify_alert_sent', {
      shop: 'demo.myshopify.com',
      health: 'RED',
    })
  })

  it('sends recovery with proof and no Improve advice', async () => {
    await sendIntegrityAlert({
      shop: { email: 'owner@example.com', slackWebhookEncrypted: null, name: 'Demo', shopDomain: 'demo.myshopify.com' },
      pathLabel: 'Tee',
      health: 'GREEN',
      reason: 'checkout_reached',
      videoUrl: null,
      gifUrl: 'https://cdn.example/walk.gif',
      screenshotUrl: null,
    })
    const payload = send.mock.calls[0]?.[0] as { subject: string; text: string }
    expect(payload.subject).toMatch(/recovered/i)
    expect(payload.text).toMatch(/Proof: https:\/\/cdn\.example\/walk\.gif/)
    expect(payload.text).not.toMatch(/improve/i)
    expect(trackEvent).toHaveBeenCalledWith('shopify_recovery_sent', { shop: 'demo.myshopify.com' })
  })
})
