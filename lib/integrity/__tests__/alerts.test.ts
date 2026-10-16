import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendIntegrityAlert } from '../alerts'

const boundary = vi.hoisted(() => ({ send: vi.fn(), fetch: vi.fn(), track: vi.fn(), source: vi.fn(), current: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { verificationRun: { findUnique: boundary.source }, revenuePath: { findFirst: boundary.current } } }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: boundary.send } } }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: boundary.track }))
vi.mock('@/lib/security/crypto', () => ({ decryptSecret: (value: string) => value }))

const authority = { id: 'path1', shopId: 'shop1', storefrontUrl: 'https://example.com/product', shop: { authorizationVersion: 1, projectId: null } }
const at = new Date('2026-10-16T00:00:00Z')
const source = { id: 'run1', pathId: 'path1', health: 'RED', confirmed: true, createdAt: at, reason: 'add_to_cart_noop',
  videoUrl: 'https://cdn.example/walk.webm', gifUrl: null, evidence: { attemptCount: 2 } }
const current = { label: 'Tee', shop: { name: 'Demo', email: 'owner@example.com', shopDomain: 'demo.myshopify.com', slackWebhookEncrypted: 'https://hooks.slack.com/services/x' } }
const send = () => sendIntegrityAlert({ authority, runId: 'run1' })

afterEach(() => vi.unstubAllGlobals())
beforeEach(() => {
  vi.resetAllMocks(); vi.stubGlobal('fetch', boundary.fetch)
  boundary.send.mockResolvedValue({ data: { id: 'accepted-email' }, error: null })
  boundary.fetch.mockResolvedValue({ ok: true })
  boundary.source.mockResolvedValue(source); boundary.current.mockResolvedValue(current)
})

describe('integrity notification admission', () => {
  it.each([null, { ...source, health: 'UNKNOWN' }, { ...source, confirmed: false }, { ...source, pathId: 'other' }])('refuses missing, unknown, unconfirmed or foreign source observations', async value => {
    boundary.source.mockResolvedValue(value)
    await send()
    expect(boundary.send).not.toHaveBeenCalled(); expect(boundary.fetch).not.toHaveBeenCalled(); expect(boundary.track).not.toHaveBeenCalled()
  })
  it('uses the exact committed failure, live grant and current recipient before sending proof', async () => {
    await send()
    expect(boundary.current).toHaveBeenCalledWith({ where: { id: 'path1', shopId: 'shop1', storefrontUrl: authority.storefrontUrl,
      shop: { id: 'shop1', uninstalledAt: null, authorizationVersion: 1, encryptedAccessToken: { not: '' }, projectId: null },
      lastVerificationRunId: 'run1', lastVerifiedAt: at, health: 'RED', reason: 'add_to_cart_noop' }, include: { shop: true } })
    expect(boundary.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@example.com', subject: "Customers can't buy: Tee", text: expect.stringContaining('Proof: https://cdn.example/walk.webm') }), expect.objectContaining({ idempotencyKey: expect.stringMatching(/^fixflags-integrity-run1-/), signal: expect.any(AbortSignal) }))
    expect(boundary.track).toHaveBeenCalledWith('shopify_alert_sent', { shop: 'demo.myshopify.com', health: 'RED' })
  })
  it('does not invent a second attempt for recovery', async () => {
    boundary.source.mockResolvedValue({ ...source, health: 'GREEN', reason: 'checkout_reached', videoUrl: null, gifUrl: 'https://cdn.example/walk.gif', evidence: { attemptCount: 1 } })
    await send()
    const payload = boundary.send.mock.calls[0][0]
    expect(payload.subject).toContain('reaches checkout again')
    expect(payload.text).toContain('fresh browser session')
    expect(payload.text).not.toMatch(/twice|two independent/i)
    expect(boundary.track).toHaveBeenCalledWith('shopify_recovery_sent', { shop: 'demo.myshopify.com' })
  })
  it('refuses revoked grants or a superseded source before any provider', async () => {
    boundary.current.mockResolvedValue(null)
    await send()
    expect(boundary.send).not.toHaveBeenCalled(); expect(boundary.fetch).not.toHaveBeenCalled(); expect(boundary.track).not.toHaveBeenCalled()
  })
  it('rechecks Slack after email waits on a provider and retains accepted email facts', async () => {
    let release!: () => void
    boundary.send.mockImplementation(() => new Promise(resolve => { release = () => resolve({ data: { id: 'accepted-email' }, error: null }) }))
    const pending = send()
    await vi.waitFor(() => expect(boundary.send).toHaveBeenCalledOnce())
    boundary.current.mockResolvedValue(null)
    release(); await pending
    expect(boundary.fetch).not.toHaveBeenCalled()
    expect(boundary.track).toHaveBeenCalledOnce()
  })
  it('does not report a provider rejection as sent', async () => {
    boundary.send.mockResolvedValue({ data: null, error: { message: 'Unavailable' } })
    boundary.current.mockResolvedValue({ ...current, shop: { ...current.shop, slackWebhookEncrypted: null } })
    await expect(send()).rejects.toThrow('Unavailable')
    expect(boundary.track).not.toHaveBeenCalled()
  })
  it('lets Slack succeed independently of email rejection', async () => {
    boundary.send.mockResolvedValue({ data: null, error: { message: 'Unavailable' } })
    await send()
    expect(boundary.fetch).toHaveBeenCalledOnce()
    expect(boundary.track).toHaveBeenCalledOnce()
  })

})
